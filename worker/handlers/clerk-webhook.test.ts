/**
 * Tests for Clerk Webhook Handler.
 *
 * Covers:
 *   - Svix signature verification (missing headers, invalid signature)
 *   - user.created / user.updated / user.deleted event handling
 *   - Missing webhook secret configuration
 *   - Users without email addresses (phone-only, social login, etc.)
 *   - Unknown event types (graceful acknowledgement)
 *
 * Uses an in-memory D1 mock (same shape as D1Database in worker/types.ts).
 * Svix verification is bypassed in happy-path tests via the _testVerify
 * injection parameter on handleClerkWebhook (same pattern as testPrisma).
 */

import { assertEquals } from '@std/assert';
import { handleClerkWebhook } from './clerk-webhook.ts';
import type { ClerkWebhookEvent, PrismaLike } from './clerk-webhook.ts';
import type { D1Database, D1ExecResult, D1PreparedStatement, D1Result, Env } from '../types.ts';

// ============================================================================
// Prisma mock helper
// ============================================================================

interface MockPrismaOptions {
    upsertResult?: { id: string };
    deleteManyResult?: { count: number };
    upsertError?: Error;
    deleteManyError?: Error;
}

function createMockPrisma(opts: MockPrismaOptions = {}): PrismaLike {
    return {
        user: {
            async upsert() {
                if (opts.upsertError) throw opts.upsertError;
                return opts.upsertResult ?? { id: 'uuid-mock-1' };
            },
            async deleteMany() {
                if (opts.deleteManyError) throw opts.deleteManyError;
                return opts.deleteManyResult ?? { count: 1 };
            },
        },
        async $disconnect() {
            /* noop */
        },
    };
}

// ============================================================================
// Clerk event fixtures
// ============================================================================

/** A minimal valid Clerk user.created / user.updated event payload. */
function makeUserCreatedEvent(userId = 'user_abc123'): ClerkWebhookEvent {
    return {
        type: 'user.created',
        data: {
            id: userId,
            email_addresses: [{ id: 'ea_1', email_address: 'alice@example.com', verification: { status: 'verified' } }],
            primary_email_address_id: 'ea_1',
            first_name: 'Alice',
            last_name: 'Smith',
            image_url: 'https://example.com/alice.jpg',
            public_metadata: { tier: 'pro', role: 'user' },
            last_sign_in_at: 1_700_000_000_000,
        },
    };
}

function makeUserUpdatedEvent(userId = 'user_abc123'): ClerkWebhookEvent {
    return { ...makeUserCreatedEvent(userId), type: 'user.updated' };
}

function makeUserDeletedEvent(userId = 'user_abc123'): ClerkWebhookEvent {
    return { type: 'user.deleted', data: { id: userId } };
}

/** Build a POST request with all required Svix headers. */
function makeSvixRequest(body: unknown): Request {
    return new Request('https://example.com/api/webhooks/clerk', {
        method: 'POST',
        headers: {
            'svix-id': 'msg_test_123',
            'svix-timestamp': String(Math.floor(Date.now() / 1000)),
            'svix-signature': 'v1,fake_signature',
        },
        body: JSON.stringify(body),
    });
}

// ============================================================================
// D1 mock helper (same interface as migrate.test.ts pattern)
// ============================================================================

function createMinimalMockD1(): D1Database {
    return {
        prepare(_query: string): D1PreparedStatement {
            const stmt: D1PreparedStatement = {
                bind(): D1PreparedStatement {
                    return stmt;
                },
                async first<T>(): Promise<T | null> {
                    return null;
                },
                async all<T>(): Promise<D1Result<T>> {
                    return { results: [], success: true };
                },
                async run(): Promise<D1Result> {
                    return { success: true };
                },
                async raw<T>(): Promise<T[]> {
                    return [];
                },
            };
            return stmt;
        },
        async dump(): Promise<ArrayBuffer> {
            return new ArrayBuffer(0);
        },
        async batch<T>(): Promise<D1Result<T>[]> {
            return [];
        },
        async exec(): Promise<D1ExecResult> {
            return { count: 0, duration: 0 };
        },
    };
}

// ============================================================================
// Fixtures
// ============================================================================

function makeEnv(overrides: Partial<Env> = {}): Env {
    return {
        CLERK_WEBHOOK_SECRET: 'whsec_test_secret_123',
        DB: createMinimalMockD1(),
        ...overrides,
    } as unknown as Env;
}

// ============================================================================
// Missing configuration
// ============================================================================

Deno.test('handleClerkWebhook - returns 503 when webhook secret not configured', async () => {
    const req = new Request('https://example.com/api/webhooks/clerk', {
        method: 'POST',
        body: '{}',
    });

    const res = await handleClerkWebhook(req, makeEnv({ CLERK_WEBHOOK_SECRET: undefined }));
    assertEquals(res.status, 503);
});

Deno.test('handleClerkWebhook - returns 503 when DB binding not configured', async () => {
    const req = makeSvixRequest({ type: 'user.created', data: { id: 'user_123' } });
    const mockVerify = () => makeUserCreatedEvent();
    const res = await handleClerkWebhook(req, makeEnv({ DB: undefined as unknown as D1Database }), null, mockVerify);
    assertEquals(res.status, 503);

    const body = await res.json() as Record<string, unknown>;
    assertEquals(typeof body.error, 'string');
});

// ============================================================================
// Missing Svix headers
// ============================================================================

Deno.test('handleClerkWebhook - returns 400 when svix-id header is missing', async () => {
    const req = new Request('https://example.com/api/webhooks/clerk', {
        method: 'POST',
        headers: {
            'svix-timestamp': String(Math.floor(Date.now() / 1000)),
            'svix-signature': 'v1,fake_signature',
        },
        body: '{}',
    });

    const res = await handleClerkWebhook(req, makeEnv());
    assertEquals(res.status, 400);

    const body = await res.json() as Record<string, unknown>;
    assertEquals((body.error as string).includes('Svix'), true);
});

Deno.test('handleClerkWebhook - returns 400 when svix-timestamp header is missing', async () => {
    const req = new Request('https://example.com/api/webhooks/clerk', {
        method: 'POST',
        headers: {
            'svix-id': 'msg_123',
            'svix-signature': 'v1,fake_signature',
        },
        body: '{}',
    });

    const res = await handleClerkWebhook(req, makeEnv());
    assertEquals(res.status, 400);
});

Deno.test('handleClerkWebhook - returns 400 when svix-signature header is missing', async () => {
    const req = new Request('https://example.com/api/webhooks/clerk', {
        method: 'POST',
        headers: {
            'svix-id': 'msg_123',
            'svix-timestamp': String(Math.floor(Date.now() / 1000)),
        },
        body: '{}',
    });

    const res = await handleClerkWebhook(req, makeEnv());
    assertEquals(res.status, 400);
});

// ============================================================================
// Invalid Svix signature
// ============================================================================

Deno.test('handleClerkWebhook - returns 401 for invalid Svix signature', async () => {
    const req = new Request('https://example.com/api/webhooks/clerk', {
        method: 'POST',
        headers: {
            'svix-id': 'msg_test_123',
            'svix-timestamp': String(Math.floor(Date.now() / 1000)),
            'svix-signature': 'v1,dGhpc19pc19hX2Zha2Vfc2lnbmF0dXJl',
        },
        body: JSON.stringify({ type: 'user.created', data: { id: 'user_123' } }),
    });

    const res = await handleClerkWebhook(req, makeEnv());
    assertEquals(res.status, 401);
});

// ============================================================================
// Happy-path tests (Webhook.verify stubbed; Prisma injected via _testPrisma)
// ============================================================================

Deno.test('handleClerkWebhook - user.created returns 200 and upserts user', async () => {
    const mockPrisma = createMockPrisma({ upsertResult: { id: 'uuid-alice-42' } });
    const mockVerify = () => makeUserCreatedEvent();
    const req = makeSvixRequest(makeUserCreatedEvent());
    const res = await handleClerkWebhook(req, makeEnv(), mockPrisma, mockVerify);
    assertEquals(res.status, 200);

    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.success, true);
    assertEquals(body.event, 'user.created');
    assertEquals(body.userId, 'uuid-alice-42');
});

Deno.test('handleClerkWebhook - user.updated returns 200 and upserts user', async () => {
    const mockPrisma = createMockPrisma({ upsertResult: { id: 'uuid-alice-7' } });
    const mockVerify = () => makeUserUpdatedEvent();
    const req = makeSvixRequest(makeUserUpdatedEvent());
    const res = await handleClerkWebhook(req, makeEnv(), mockPrisma, mockVerify);
    assertEquals(res.status, 200);

    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.success, true);
    assertEquals(body.event, 'user.updated');
});

Deno.test('handleClerkWebhook - user.deleted returns 200 and removes user', async () => {
    const mockPrisma = createMockPrisma({ deleteManyResult: { count: 1 } });
    const mockVerify = () => makeUserDeletedEvent();
    const req = makeSvixRequest(makeUserDeletedEvent());
    const res = await handleClerkWebhook(req, makeEnv(), mockPrisma, mockVerify);
    assertEquals(res.status, 200);

    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.success, true);
    assertEquals(body.event, 'user.deleted');
    assertEquals(body.deleted, true);
});

Deno.test('handleClerkWebhook - user.deleted returns deleted=false when user not found', async () => {
    const mockPrisma = createMockPrisma({ deleteManyResult: { count: 0 } });
    const mockVerify = () => makeUserDeletedEvent('user_gone');
    const req = makeSvixRequest(makeUserDeletedEvent('user_gone'));
    const res = await handleClerkWebhook(req, makeEnv(), mockPrisma, mockVerify);
    assertEquals(res.status, 200);

    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.deleted, false);
});

Deno.test('handleClerkWebhook - user.created succeeds without email address', async () => {
    const noEmailEvent: ClerkWebhookEvent = {
        type: 'user.created',
        data: {
            id: 'user_noemail',
            email_addresses: [],
            first_name: 'John',
            last_name: 'Doe',
            image_url: 'https://img.clerk.com/xxxxxx',
            public_metadata: {},
        },
    };
    const mockPrisma = createMockPrisma({ upsertResult: { id: 'uuid-noemail-1' } });
    const mockVerify = () => noEmailEvent;
    const req = makeSvixRequest(noEmailEvent);
    const res = await handleClerkWebhook(req, makeEnv(), mockPrisma, mockVerify);
    assertEquals(res.status, 200);

    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.success, true);
    assertEquals(body.event, 'user.created');
    assertEquals(body.userId, 'uuid-noemail-1');
});

Deno.test('handleClerkWebhook - returns 200 for unknown event type', async () => {
    const unknownEvent = { type: 'session.created', data: { id: 'sess_xyz' } };
    const mockPrisma = createMockPrisma();
    const mockVerify = () => unknownEvent as ClerkWebhookEvent;
    const req = makeSvixRequest(unknownEvent);
    const res = await handleClerkWebhook(req, makeEnv(), mockPrisma, mockVerify);
    assertEquals(res.status, 200);

    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.success, true);
    assertEquals(body.event, 'session.created');
});

Deno.test('handleClerkWebhook - returns 500 when prisma upsert throws', async () => {
    const mockPrisma = createMockPrisma({ upsertError: new Error('D1 constraint violation') });
    const mockVerify = () => makeUserCreatedEvent();
    const req = makeSvixRequest(makeUserCreatedEvent());
    const res = await handleClerkWebhook(req, makeEnv(), mockPrisma, mockVerify);
    assertEquals(res.status, 500);
});
