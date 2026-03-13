/**
 * Handler for POST /api/webhooks/clerk
 *
 * Receives Clerk webhook events, verifies the Svix signature, and
 * syncs user data to the local PostgreSQL users table.
 *
 * Supported events:
 *   - user.created  → upsert user record
 *   - user.updated  → upsert user record (tier/role from public_metadata)
 *   - user.deleted  → delete user record
 *
 * Security: Svix HMAC signature verification (no JWT / API-key auth).
 */

import { Webhook } from 'svix';
import { type ClerkUserData, deleteUserByClerkId, upsertUserFromClerk } from '../services/user-service.ts';
import { JsonResponse } from '../utils/response.ts';
import type { Env } from '../types.ts';

// ---------------------------------------------------------------------------
// PgPool interface (matches worker/middleware/auth.ts)
// ---------------------------------------------------------------------------

interface PgPool {
    query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

type PgPoolFactory = (connectionString: string) => PgPool;

// ---------------------------------------------------------------------------
// Clerk webhook event shapes (subset we care about)
// ---------------------------------------------------------------------------

interface ClerkEmailAddress {
    readonly email_address: string;
    readonly id: string;
    readonly verification?: { readonly status: string } | null;
}

interface ClerkUserEventData {
    readonly id: string;
    readonly email_addresses?: readonly ClerkEmailAddress[];
    readonly primary_email_address_id?: string;
    readonly first_name?: string | null;
    readonly last_name?: string | null;
    readonly image_url?: string | null;
    readonly public_metadata?: Record<string, unknown>;
    readonly last_sign_in_at?: number | null;
}

interface ClerkWebhookEvent {
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

/** Map Clerk event data to our ClerkUserData shape. */
function toClerkUserData(data: ClerkUserEventData): ClerkUserData | null {
    const email = extractPrimaryEmail(data);
    if (!email) return null;

    const meta = data.public_metadata ?? {};

    return {
        clerkUserId: data.id,
        email,
        firstName: data.first_name,
        lastName: data.last_name,
        imageUrl: data.image_url,
        emailVerified: isEmailVerified(data),
        tier: typeof meta.tier === 'string' ? meta.tier : undefined,
        role: typeof meta.role === 'string' ? meta.role : undefined,
        lastSignInAt: data.last_sign_in_at ? new Date(data.last_sign_in_at).toISOString() : null,
    };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function handleClerkWebhook(
    request: Request,
    env: Env,
    createPool: PgPoolFactory,
): Promise<Response> {
    // ---- 1. Validate that the webhook secret is configured ----
    const webhookSecret = env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
        return JsonResponse.serviceUnavailable('Clerk webhook secret not configured');
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
        const wh = new Webhook(webhookSecret);
        event = wh.verify(rawBody, {
            'svix-id': svixId,
            'svix-timestamp': svixTimestamp,
            'svix-signature': svixSignature,
        }) as ClerkWebhookEvent;
    } catch {
        return JsonResponse.error('Invalid webhook signature', 401);
    }

    // ---- 4. Obtain a database connection ----
    const hyperdrive = env.HYPERDRIVE;
    if (!hyperdrive) {
        return JsonResponse.serviceUnavailable('Database not configured');
    }

    const pool = createPool(hyperdrive.connectionString);

    // ---- 5. Handle event ----
    try {
        switch (event.type) {
            case 'user.created':
            case 'user.updated': {
                const userData = toClerkUserData(event.data);
                if (!userData) {
                    return JsonResponse.badRequest('Missing primary email in Clerk event');
                }
                const user = await upsertUserFromClerk(pool, userData);
                return Response.json(
                    { success: true, event: event.type, userId: user?.id ?? null },
                    { status: 200 },
                );
            }
            case 'user.deleted': {
                const deleted = await deleteUserByClerkId(pool, event.data.id);
                return Response.json(
                    { success: true, event: event.type, deleted },
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
    }
}
