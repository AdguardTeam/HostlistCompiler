/**
 * Handler for POST /api/webhooks/clerk
 *
 * Receives Clerk webhook events, verifies the Svix signature, and
 * syncs user data to D1 (SQLite) via the native D1 binding.
 *
 * Supported events:
 *   - user.created  → upsert user record
 *   - user.updated  → upsert user record (tier/role from public_metadata)
 *   - user.deleted  → delete user record
 *
 * Security: Svix HMAC signature verification (no JWT / API-key auth).
 *
 * Note: this handler intentionally does NOT use the Prisma-generated D1 client.
 * The `prisma-client` generator (v7) embeds a WASM-based query compiler that calls
 * `new WebAssembly.Module(base64Data)` at instantiation time — an operation blocked by
 * Cloudflare Workers' embedder.  The {@link D1UserStore} class below uses the D1
 * binding's `prepare/bind/run/first` API directly and carries no WASM dependency.
 */

import { Webhook } from 'svix';
import { JsonResponse } from '../utils/response.ts';
import { UserTier } from '../types.ts';
import type { Env } from '../types.ts';
import { ClerkWebhookEventBaseSchema, ClerkWebhookUserDataSchema } from '../schemas.ts';
import type { ClerkWebhookEventBase, ClerkWebhookUserData } from '../schemas.ts';

// ---------------------------------------------------------------------------
// Metadata validation helpers
// ---------------------------------------------------------------------------

/** Valid user roles stored in Prisma. */
const VALID_ROLES = new Set(['user', 'admin']);

/**
 * Validates a tier value from Clerk metadata against the {@link UserTier} enum.
 * Returns the validated tier or `undefined` if invalid/absent.
 * Admin tier is never accepted from webhook metadata — must be granted server-side.
 */
function validateTier(value: unknown): UserTier | undefined {
    if (typeof value === 'string' && (Object.values(UserTier) as string[]).includes(value) && value !== UserTier.Admin) {
        return value as UserTier;
    }
    return undefined;
}

/**
 * Validates a role value from Clerk metadata against the allowed role set.
 * Returns the validated role or `undefined` if invalid/absent.
 * Admin role is never accepted from webhook metadata — must be granted server-side.
 */
function validateRole(value: unknown): string | undefined {
    if (typeof value === 'string' && VALID_ROLES.has(value) && value !== 'admin') {
        return value;
    }
    return undefined;
}

// ---------------------------------------------------------------------------
// Clerk webhook event shapes (subset we care about)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Clerk webhook event shapes
// Re-exported from schemas.ts for backward compatibility with tests.
// ---------------------------------------------------------------------------

/** @internal Clerk email address shape in webhook payloads. */
export interface ClerkEmailAddress {
    readonly email_address: string;
    readonly id: string;
    readonly verification?: { readonly status: string } | null;
}

/** @internal Clerk user data shape in webhook payloads. */
export type ClerkUserEventData = ClerkWebhookUserData;

/** @internal Clerk webhook event shape. */
export type ClerkWebhookEvent = ClerkWebhookEventBase;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the primary email from Clerk's email_addresses array. */
function extractPrimaryEmail(data: ClerkUserEventData): string | null {
    if (!data.email_addresses?.length) return null;
    if (data.primary_email_address_id) {
        const primary = data.email_addresses.find((e) => e.id === data.primary_email_address_id);
        if (primary) return primary.email_address;
    }
    return data.email_addresses[0].email_address;
}

/** Check if the primary email is verified. */
function isEmailVerified(data: ClerkUserEventData): boolean {
    if (!data.email_addresses?.length) return false;
    const primary = data.primary_email_address_id ? data.email_addresses.find((e) => e.id === data.primary_email_address_id) : data.email_addresses[0];
    return primary?.verification?.status === 'verified';
}

/** Build a display name from Clerk event data. */
function toDisplayName(data: ClerkUserEventData, fallbackEmail: string | null): string {
    if (data.first_name && data.last_name) return `${data.first_name} ${data.last_name}`;
    if (data.first_name) return data.first_name;
    if (fallbackEmail) return fallbackEmail;
    return data.id;
}

// ---------------------------------------------------------------------------
// Prisma abstraction (allows injection for unit testing)
// ---------------------------------------------------------------------------

/**
 * Minimal Prisma-like interface used by this handler.
 * Exported so unit tests can inject a mock without depending on the full
 * generated Prisma client.
 * @internal
 */
export interface PrismaLike {
    user: {
        upsert(args: unknown): Promise<{ id: string }>;
        deleteMany(args: unknown): Promise<{ count: number }>;
    };
    $disconnect(): Promise<void>;
}

// ---------------------------------------------------------------------------
// D1-native implementation of PrismaLike (no WASM dependency)
// ---------------------------------------------------------------------------

/**
 * Implements {@link PrismaLike} using the D1 binding's `prepare/bind/run/first` API.
 *
 * The Prisma-generated D1 client calls `new WebAssembly.Module(base64Data)` at
 * instantiation time, which Cloudflare Workers' embedder blocks.  This class
 * replaces that client for the webhook handler with plain SQL — no WASM required.
 *
 * Operations:
 *   - `user.upsert`    — single atomic `INSERT … ON CONFLICT(clerk_user_id) DO UPDATE`
 *   - `user.deleteMany` — DELETE WHERE clerk_user_id = ?
 *   - `$disconnect`    — no-op (D1 connections are managed by the runtime)
 */
class D1UserStore implements PrismaLike {
    constructor(private readonly db: NonNullable<Env['DB']>) {}

    readonly user = {
        upsert: async (rawArgs: unknown): Promise<{ id: string }> => {
            const { create, update } = rawArgs as {
                where: { clerkUserId: string };
                create: {
                    clerkUserId: string;
                    email: string | null;
                    displayName: string;
                    firstName: string | null;
                    lastName: string | null;
                    imageUrl: string | null;
                    emailVerified: boolean;
                    tier: string;
                    role: string;
                    lastSignInAt: Date | null;
                };
                update: {
                    email?: string;
                    emailVerified?: boolean;
                    displayName?: string;
                    firstName?: string | null;
                    lastName?: string | null;
                    imageUrl?: string | null;
                    tier?: string;
                    role?: string;
                    lastSignInAt?: Date | null;
                };
            };

            // email/emailVerified are conditionally present in update (emailless users omit them).
            // Passing null to COALESCE(?, col) preserves the existing column value.
            const updateEmail = 'email' in update ? (update.email ?? null) : null;
            const updateEmailVerified = 'emailVerified' in update ? (update.emailVerified ? 1 : 0) : null;
            // tier/role from Clerk metadata may be undefined (invalid) — preserve existing in that case.
            const updateTier = update.tier !== undefined ? update.tier : null;
            const updateRole = update.role !== undefined ? update.role : null;
            const updateLastSignInAt = update.lastSignInAt ? update.lastSignInAt.toISOString() : null;

            // Single atomic upsert: avoids the race between a separate UPDATE and INSERT
            // under concurrent Clerk webhook delivery.  ON CONFLICT targets clerk_user_id
            // (the unique constraint), making retried deliveries idempotent.
            // created_at / updated_at are always included to satisfy NOT NULL constraints.
            const id = crypto.randomUUID();
            const row = await this.db
                .prepare(
                    `INSERT INTO users
                         (id, clerk_user_id, email, display_name, first_name, last_name, image_url, email_verified, tier, role, last_sign_in_at, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                     ON CONFLICT(clerk_user_id) DO UPDATE SET
                         email           = COALESCE(?, users.email),
                         email_verified  = COALESCE(?, users.email_verified),
                         display_name    = ?,
                         first_name      = ?,
                         last_name       = ?,
                         image_url       = ?,
                         tier            = COALESCE(?, users.tier),
                         role            = COALESCE(?, users.role),
                         last_sign_in_at = ?,
                         updated_at      = datetime('now')
                     RETURNING id`,
                )
                .bind(
                    // INSERT values (11 params — created_at/updated_at use datetime('now'))
                    id,
                    create.clerkUserId,
                    create.email,
                    create.displayName,
                    create.firstName,
                    create.lastName,
                    create.imageUrl,
                    create.emailVerified ? 1 : 0,
                    create.tier,
                    create.role,
                    create.lastSignInAt ? create.lastSignInAt.toISOString() : null,
                    // ON CONFLICT DO UPDATE SET values (9 params)
                    updateEmail,
                    updateEmailVerified,
                    update.displayName !== undefined ? update.displayName : create.displayName,
                    update.firstName !== undefined ? update.firstName : create.firstName,
                    update.lastName !== undefined ? update.lastName : create.lastName,
                    update.imageUrl !== undefined ? update.imageUrl : create.imageUrl,
                    updateTier,
                    updateRole,
                    updateLastSignInAt,
                )
                .first<{ id: string }>();

            return { id: row!.id };
        },

        deleteMany: async (rawArgs: unknown): Promise<{ count: number }> => {
            const { where } = rawArgs as { where: { clerkUserId: string } };
            const result = await this.db
                .prepare('DELETE FROM users WHERE clerk_user_id = ?')
                .bind(where.clerkUserId)
                .run();
            return { count: result.meta?.changes ?? 0 };
        },
    };

    async $disconnect(): Promise<void> {
        // D1 connections are managed by the Workers runtime — nothing to close.
    }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function handleClerkWebhook(
    request: Request,
    env: Env,
    /** Injected Prisma client — for unit testing only. Omit in production. */
    testPrisma?: PrismaLike | null,
    /**
     * Injected Svix verify function — for unit testing only.
     * When provided, replaces `new Webhook(secret).verify(body, headers)` so
     * tests can bypass HMAC validation without prototype-stubbing npm packages.
     * Omit in production.
     * @internal
     */
    _testVerify?: ((body: string, headers: Record<string, string>) => ClerkWebhookEvent) | null,
): Promise<Response> {
    // ---- 1. Validate that the webhook secret is configured ----
    const webhookSecret = env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
        return JsonResponse.serviceUnavailable(
            'Clerk webhook secret not configured. ' +
                'Run: wrangler secret put CLERK_WEBHOOK_SECRET',
        );
    }

    // ---- 2. Read raw body + required Svix headers ----
    const svixId = request.headers.get('svix-id');
    const svixTimestamp = request.headers.get('svix-timestamp');
    const svixSignature = request.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
        return JsonResponse.badRequest('Missing Svix signature headers');
    }

    let rawBody: string;
    try {
        rawBody = await request.text();
    } catch {
        return JsonResponse.badRequest('Could not read request body');
    }

    // ---- 3. Verify Svix signature ----
    let event: ClerkWebhookEvent;
    try {
        const svixHeaders = { 'svix-id': svixId, 'svix-timestamp': svixTimestamp, 'svix-signature': svixSignature };
        const raw = _testVerify ? _testVerify(rawBody, svixHeaders) : (new Webhook(webhookSecret).verify(rawBody, svixHeaders));

        const parsed = ClerkWebhookEventBaseSchema.safeParse(raw);
        if (!parsed.success) {
            return JsonResponse.badRequest('Invalid webhook payload structure');
        }
        event = parsed.data;
    } catch {
        return JsonResponse.error('Invalid webhook signature', 401);
    }

    // ---- 4. Obtain the D1 database binding ----
    const db = env.DB;
    if (!db) {
        return JsonResponse.serviceUnavailable(
            'D1 database binding not configured. ' +
                'Ensure the DB binding is present in wrangler.toml.',
        );
    }

    // ---- 5. Handle event ----
    let prisma: PrismaLike | null = null;
    try {
        prisma = testPrisma ?? new D1UserStore(db);

        switch (event.type) {
            case 'user.created':
            case 'user.updated': {
                const userData = ClerkWebhookUserDataSchema.safeParse(event.data);
                if (!userData.success) {
                    return JsonResponse.badRequest('Invalid user event data structure');
                }
                const data = userData.data;

                const email = extractPrimaryEmail(data);
                const meta = data.public_metadata ?? {};
                const lastSignInAt = data.last_sign_in_at ? new Date(data.last_sign_in_at) : null;

                const user = await prisma.user.upsert({
                    where: { clerkUserId: data.id },
                    create: {
                        email: email ?? null,
                        clerkUserId: data.id,
                        displayName: toDisplayName(data, email),
                        firstName: data.first_name ?? null,
                        lastName: data.last_name ?? null,
                        imageUrl: data.image_url ?? null,
                        emailVerified: isEmailVerified(data),
                        tier: validateTier(meta['tier']) ?? UserTier.Free,
                        role: validateRole(meta['role']) ?? 'user',
                        lastSignInAt,
                    },
                    update: {
                        // Only update email/emailVerified if the event includes an email address;
                        // leave the existing DB values intact when email_addresses is empty.
                        ...(email !== null && { email, emailVerified: isEmailVerified(data) }),
                        displayName: toDisplayName(data, email),
                        firstName: data.first_name ?? null,
                        lastName: data.last_name ?? null,
                        imageUrl: data.image_url ?? null,
                        tier: validateTier(meta['tier']),
                        role: validateRole(meta['role']),
                        lastSignInAt,
                    },
                });

                return Response.json(
                    { success: true, event: event.type, userId: user.id },
                    { status: 200 },
                );
            }

            case 'user.deleted': {
                const result = await prisma.user.deleteMany({ where: { clerkUserId: event.data.id } });

                return Response.json(
                    { success: true, event: event.type, deleted: result.count > 0 },
                    { status: 200 },
                );
            }

            default:
                // Acknowledge unknown events gracefully
                return Response.json(
                    { success: true, event: event.type, message: 'Event type not handled' },
                    { status: 200 },
                );
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return JsonResponse.serverError(`Webhook processing failed: ${message}`);
    } finally {
        if (prisma !== null) await prisma.$disconnect();
    }
}
