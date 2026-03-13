/**
 * Handler for POST /api/webhooks/clerk
 *
 * Receives Clerk webhook events, verifies the Svix signature, and
 * syncs user data to D1 (SQLite) via Prisma with the @prisma/adapter-d1 adapter.
 *
 * Supported events:
 *   - user.created  → upsert user record
 *   - user.updated  → upsert user record (tier/role from public_metadata)
 *   - user.deleted  → delete user record
 *
 * Security: Svix HMAC signature verification (no JWT / API-key auth).
 */

import { Webhook } from 'svix';
import { PrismaClient } from '../../prisma/generated-d1/client.ts';
import { PrismaD1 } from '@prisma/adapter-d1';
import { JsonResponse } from '../utils/response.ts';
import { UserTier } from '../types.ts';
import type { Env } from '../types.ts';

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

/** @internal Clerk email address shape in webhook payloads. */
export interface ClerkEmailAddress {
    readonly email_address: string;
    readonly id: string;
    readonly verification?: { readonly status: string } | null;
}

/** @internal Clerk user data shape in webhook payloads. */
export interface ClerkUserEventData {
    readonly id: string;
    readonly email_addresses?: readonly ClerkEmailAddress[];
    readonly primary_email_address_id?: string;
    readonly first_name?: string | null;
    readonly last_name?: string | null;
    readonly image_url?: string | null;
    readonly public_metadata?: Record<string, unknown>;
    readonly last_sign_in_at?: number | null;
}

/** @internal Clerk webhook event shape. */
export interface ClerkWebhookEvent {
    readonly type: string;
    readonly data: ClerkUserEventData;
}

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
function toDisplayName(data: ClerkUserEventData, fallbackEmail: string): string {
    if (data.first_name && data.last_name) return `${data.first_name} ${data.last_name}`;
    if (data.first_name) return data.first_name;
    return fallbackEmail;
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
        event = _testVerify ? _testVerify(rawBody, svixHeaders) : (new Webhook(webhookSecret).verify(rawBody, svixHeaders) as ClerkWebhookEvent);
    } catch {
        return JsonResponse.error('Invalid webhook signature', 401);
    }

    // ---- 4. Obtain a D1 database connection via Prisma ----
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
        prisma = testPrisma ?? (() => {
            const adapter = new PrismaD1(db);
            return new PrismaClient({ adapter }) as unknown as PrismaLike;
        })();

        switch (event.type) {
            case 'user.created':
            case 'user.updated': {
                const email = extractPrimaryEmail(event.data);
                if (!email) {
                    return JsonResponse.badRequest('Missing primary email in Clerk event');
                }

                const meta = event.data.public_metadata ?? {};
                const lastSignInAt = event.data.last_sign_in_at ? new Date(event.data.last_sign_in_at) : null;

                const user = await prisma.user.upsert({
                    where: { clerkUserId: event.data.id },
                    create: {
                        email,
                        clerkUserId: event.data.id,
                        displayName: toDisplayName(event.data, email),
                        firstName: event.data.first_name ?? null,
                        lastName: event.data.last_name ?? null,
                        imageUrl: event.data.image_url ?? null,
                        emailVerified: isEmailVerified(event.data),
                        tier: validateTier(meta['tier']) ?? UserTier.Free,
                        role: validateRole(meta['role']) ?? 'user',
                        lastSignInAt,
                    },
                    update: {
                        email,
                        displayName: toDisplayName(event.data, email),
                        firstName: event.data.first_name ?? null,
                        lastName: event.data.last_name ?? null,
                        imageUrl: event.data.image_url ?? null,
                        emailVerified: isEmailVerified(event.data),
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
