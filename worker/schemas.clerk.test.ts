/**
 * Tests for Clerk auth Zod schemas
 *
 * Covers all security-relevant schemas added in #1012:
 *   - ClerkWebhookEventBaseSchema / ClerkWebhookEventSchema
 *   - ClerkWebhookUserDataSchema
 *   - ClerkJWTClaimsSchema
 *   - CreateApiKeyRequestSchema / UpdateApiKeyRequestSchema
 *   - ApiKeyRowSchema
 *   - UserTierRowSchema
 */

import { assertEquals } from '@std/assert';
import {
    ApiKeyRowSchema,
    ClerkJWTClaimsSchema,
    ClerkWebhookEventBaseSchema,
    ClerkWebhookEventSchema,
    ClerkWebhookUserDataSchema,
    CreateApiKeyRequestSchema,
    UpdateApiKeyRequestSchema,
    UserTierRowSchema,
} from './schemas.ts';
import { AuthScope, UserTier } from './types.ts';

// ============================================================================
// ClerkWebhookEventBaseSchema
// ============================================================================

Deno.test('ClerkWebhookEventBaseSchema — accepts known event types', () => {
    const event = { type: 'user.created', data: { id: 'user_123' } };
    assertEquals(ClerkWebhookEventBaseSchema.safeParse(event).success, true);
});

Deno.test('ClerkWebhookEventBaseSchema — accepts unknown event types (graceful)', () => {
    // Svix retries 4xx; unknown events must return 200 not 400
    const event = { type: 'session.created', data: { id: 'sess_abc' } };
    assertEquals(ClerkWebhookEventBaseSchema.safeParse(event).success, true);
});

Deno.test('ClerkWebhookEventBaseSchema — rejects missing type', () => {
    const event = { data: { id: 'user_123' } };
    assertEquals(ClerkWebhookEventBaseSchema.safeParse(event).success, false);
});

Deno.test('ClerkWebhookEventBaseSchema — rejects empty type', () => {
    const event = { type: '', data: { id: 'user_123' } };
    assertEquals(ClerkWebhookEventBaseSchema.safeParse(event).success, false);
});

Deno.test('ClerkWebhookEventBaseSchema — rejects missing data', () => {
    const event = { type: 'user.created' };
    assertEquals(ClerkWebhookEventBaseSchema.safeParse(event).success, false);
});

Deno.test('ClerkWebhookEventBaseSchema — rejects missing data.id', () => {
    const event = { type: 'user.created', data: {} };
    assertEquals(ClerkWebhookEventBaseSchema.safeParse(event).success, false);
});

Deno.test('ClerkWebhookEventBaseSchema — rejects empty data.id', () => {
    const event = { type: 'user.created', data: { id: '' } };
    assertEquals(ClerkWebhookEventBaseSchema.safeParse(event).success, false);
});

// ============================================================================
// ClerkWebhookEventSchema (strict enum)
// ============================================================================

Deno.test('ClerkWebhookEventSchema — accepts known event types only', () => {
    assertEquals(ClerkWebhookEventSchema.safeParse({ type: 'user.created', data: { id: 'u1' } }).success, true);
    assertEquals(ClerkWebhookEventSchema.safeParse({ type: 'user.updated', data: { id: 'u1' } }).success, true);
    assertEquals(ClerkWebhookEventSchema.safeParse({ type: 'user.deleted', data: { id: 'u1' } }).success, true);
});

Deno.test('ClerkWebhookEventSchema — rejects unknown event types', () => {
    const event = { type: 'session.created', data: { id: 'u1' } };
    assertEquals(ClerkWebhookEventSchema.safeParse(event).success, false);
});

// ============================================================================
// ClerkWebhookUserDataSchema
// ============================================================================

Deno.test('ClerkWebhookUserDataSchema — accepts minimal valid user data', () => {
    const data = {
        id: 'user_abc',
        email_addresses: [{ id: 'ea_1', email_address: 'test@example.com', verification: { status: 'verified' } }],
        primary_email_address_id: 'ea_1',
    };
    assertEquals(ClerkWebhookUserDataSchema.safeParse(data).success, true);
});

Deno.test('ClerkWebhookUserDataSchema — accepts data without email (emailless users)', () => {
    const data = { id: 'user_abc', email_addresses: [] };
    assertEquals(ClerkWebhookUserDataSchema.safeParse(data).success, true);
});

Deno.test('ClerkWebhookUserDataSchema — rejects missing id', () => {
    const data = { email_addresses: [] };
    assertEquals(ClerkWebhookUserDataSchema.safeParse(data).success, false);
});

Deno.test('ClerkWebhookUserDataSchema — rejects empty id', () => {
    const data = { id: '', email_addresses: [] };
    assertEquals(ClerkWebhookUserDataSchema.safeParse(data).success, false);
});

Deno.test('ClerkWebhookUserDataSchema — allows extra fields via passthrough', () => {
    const data = {
        id: 'user_abc',
        email_addresses: [],
        extra_future_field: 'value',
        nested: { foo: 'bar' },
    };
    const result = ClerkWebhookUserDataSchema.safeParse(data);
    assertEquals(result.success, true);
    // Extra fields should be preserved
    if (result.success) {
        assertEquals((result.data as Record<string, unknown>)['extra_future_field'], 'value');
    }
});

// ============================================================================
// ClerkJWTClaimsSchema
// ============================================================================

Deno.test('ClerkJWTClaimsSchema — accepts valid JWT claims', () => {
    const claims = {
        sub: 'user_abc123',
        iss: 'https://clerk.example.com',
        iat: 1700000000,
        exp: 1700003600,
    };
    assertEquals(ClerkJWTClaimsSchema.safeParse(claims).success, true);
});

Deno.test('ClerkJWTClaimsSchema — accepts claims with sid and metadata', () => {
    const claims = {
        sub: 'user_abc',
        iss: 'https://clerk.example.com',
        iat: 1700000000,
        exp: 1700003600,
        sid: 'sess_xyz',
        metadata: { tier: 'pro', role: 'admin' },
    };
    assertEquals(ClerkJWTClaimsSchema.safeParse(claims).success, true);
});

Deno.test('ClerkJWTClaimsSchema — rejects missing sub', () => {
    const claims = { iss: 'https://clerk.example.com', iat: 1700000000, exp: 1700003600 };
    assertEquals(ClerkJWTClaimsSchema.safeParse(claims).success, false);
});

Deno.test('ClerkJWTClaimsSchema — rejects empty sub', () => {
    const claims = { sub: '', iss: 'https://clerk.example.com', iat: 1700000000, exp: 1700003600 };
    assertEquals(ClerkJWTClaimsSchema.safeParse(claims).success, false);
});

Deno.test('ClerkJWTClaimsSchema — rejects missing iss', () => {
    const claims = { sub: 'user_abc', iat: 1700000000, exp: 1700003600 };
    assertEquals(ClerkJWTClaimsSchema.safeParse(claims).success, false);
});

Deno.test('ClerkJWTClaimsSchema — allows extra claims via passthrough', () => {
    const claims = {
        sub: 'user_abc',
        iss: 'https://clerk.example.com',
        iat: 1700000000,
        exp: 1700003600,
        nbf: 1700000000,
        jti: 'unique-id',
        azp: 'client_id',
    };
    assertEquals(ClerkJWTClaimsSchema.safeParse(claims).success, true);
});

// ============================================================================
// CreateApiKeyRequestSchema
// ============================================================================

Deno.test('CreateApiKeyRequestSchema — accepts minimal valid request', () => {
    const body = { name: 'My Key' };
    const result = CreateApiKeyRequestSchema.safeParse(body);
    assertEquals(result.success, true);
    // Default scopes should be applied
    if (result.success) {
        assertEquals(result.data.scopes, [AuthScope.Compile]);
    }
});

Deno.test('CreateApiKeyRequestSchema — accepts full valid request', () => {
    const body = { name: 'CI Key', scopes: ['compile'], expiresInDays: 30 };
    assertEquals(CreateApiKeyRequestSchema.safeParse(body).success, true);
});

Deno.test('CreateApiKeyRequestSchema — rejects empty name', () => {
    assertEquals(CreateApiKeyRequestSchema.safeParse({ name: '' }).success, false);
});

Deno.test('CreateApiKeyRequestSchema — rejects whitespace-only name', () => {
    assertEquals(CreateApiKeyRequestSchema.safeParse({ name: '   ' }).success, false);
});

Deno.test('CreateApiKeyRequestSchema — rejects name exceeding 100 chars', () => {
    const body = { name: 'a'.repeat(101) };
    assertEquals(CreateApiKeyRequestSchema.safeParse(body).success, false);
});

Deno.test('CreateApiKeyRequestSchema — rejects invalid scope values', () => {
    const body = { name: 'Key', scopes: ['invalid_scope'] };
    assertEquals(CreateApiKeyRequestSchema.safeParse(body).success, false);
});

Deno.test('CreateApiKeyRequestSchema — rejects expiresInDays below 1', () => {
    assertEquals(CreateApiKeyRequestSchema.safeParse({ name: 'K', expiresInDays: 0 }).success, false);
});

Deno.test('CreateApiKeyRequestSchema — rejects expiresInDays above 365', () => {
    assertEquals(CreateApiKeyRequestSchema.safeParse({ name: 'K', expiresInDays: 366 }).success, false);
});

Deno.test('CreateApiKeyRequestSchema — rejects missing name', () => {
    assertEquals(CreateApiKeyRequestSchema.safeParse({}).success, false);
});

// ============================================================================
// UpdateApiKeyRequestSchema
// ============================================================================

Deno.test('UpdateApiKeyRequestSchema — accepts name-only update', () => {
    assertEquals(UpdateApiKeyRequestSchema.safeParse({ name: 'New Name' }).success, true);
});

Deno.test('UpdateApiKeyRequestSchema — accepts scopes-only update', () => {
    assertEquals(UpdateApiKeyRequestSchema.safeParse({ scopes: ['compile'] }).success, true);
});

Deno.test('UpdateApiKeyRequestSchema — accepts both name and scopes', () => {
    assertEquals(UpdateApiKeyRequestSchema.safeParse({ name: 'N', scopes: ['compile'] }).success, true);
});

Deno.test('UpdateApiKeyRequestSchema — rejects empty body (at least one field required)', () => {
    assertEquals(UpdateApiKeyRequestSchema.safeParse({}).success, false);
});

Deno.test('UpdateApiKeyRequestSchema — rejects whitespace-only name', () => {
    assertEquals(UpdateApiKeyRequestSchema.safeParse({ name: '   ' }).success, false);
});

Deno.test('UpdateApiKeyRequestSchema — rejects invalid scopes', () => {
    assertEquals(UpdateApiKeyRequestSchema.safeParse({ scopes: ['bad_scope'] }).success, false);
});

// ============================================================================
// ApiKeyRowSchema
// ============================================================================

Deno.test('ApiKeyRowSchema — accepts valid DB row', () => {
    const row = {
        id: 'uuid-1',
        user_id: 'user_abc',
        key_prefix: 'abc_XXXX',
        name: 'My Key',
        scopes: ['compile'],
        rate_limit_per_minute: 60,
        last_used_at: null,
        expires_at: null,
        revoked_at: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
    };
    assertEquals(ApiKeyRowSchema.safeParse(row).success, true);
});

Deno.test('ApiKeyRowSchema — rejects missing required fields', () => {
    const row = { id: 'uuid-1' };
    assertEquals(ApiKeyRowSchema.safeParse(row).success, false);
});

Deno.test('ApiKeyRowSchema — rejects non-number rate_limit_per_minute', () => {
    const row = {
        id: 'uuid-1',
        user_id: 'u1',
        key_prefix: 'abc_',
        name: 'K',
        scopes: ['compile'],
        rate_limit_per_minute: 'fast',
        last_used_at: null,
        expires_at: null,
        revoked_at: null,
        created_at: 'ts',
        updated_at: 'ts',
    };
    assertEquals(ApiKeyRowSchema.safeParse(row).success, false);
});

// ============================================================================
// UserTierRowSchema
// ============================================================================

Deno.test('UserTierRowSchema — accepts all valid tiers', () => {
    for (const tier of Object.values(UserTier)) {
        assertEquals(UserTierRowSchema.safeParse({ tier }).success, true, `Expected ${tier} to be valid`);
    }
});

Deno.test('UserTierRowSchema — rejects unknown tier value', () => {
    assertEquals(UserTierRowSchema.safeParse({ tier: 'enterprise' }).success, false);
    assertEquals(UserTierRowSchema.safeParse({ tier: 'ADMIN' }).success, false);
});

Deno.test('UserTierRowSchema — rejects missing tier', () => {
    assertEquals(UserTierRowSchema.safeParse({}).success, false);
});
