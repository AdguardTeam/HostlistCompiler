/**
 * Tests for Zod schemas used at the database model boundary.
 */

import { assertEquals } from '@std/assert';
import {
    CreateApiKeySchema,
    CreateCompilationEventSchema,
    CreateCompiledOutputSchema,
    CreateFilterListVersionSchema,
    CreateFilterSourceSchema,
    CreateSessionSchema,
    CreateSourceChangeEventSchema,
    CreateSourceHealthSnapshotSchema,
    CreateUserSchema,
} from './schemas.ts';

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const VALID_HASH = 'a'.repeat(64);
const VALID_URL = 'https://example.com/list.txt';

// ============================================================================
// CreateUserSchema
// ============================================================================

Deno.test('CreateUserSchema - should validate minimal user', () => {
    const result = CreateUserSchema.safeParse({ email: 'user@example.com' });
    assertEquals(result.success, true);
    if (result.success) {
        assertEquals(result.data.role, 'user');
    }
});

Deno.test('CreateUserSchema - should validate full user', () => {
    const result = CreateUserSchema.safeParse({
        email: 'admin@example.com',
        displayName: 'Admin User',
        role: 'admin',
    });
    assertEquals(result.success, true);
});

Deno.test('CreateUserSchema - should reject invalid email', () => {
    const result = CreateUserSchema.safeParse({ email: 'not-an-email' });
    assertEquals(result.success, false);
});

Deno.test('CreateUserSchema - should reject invalid role', () => {
    const result = CreateUserSchema.safeParse({ email: 'user@example.com', role: 'superuser' });
    assertEquals(result.success, false);
});

// ============================================================================
// CreateApiKeySchema
// ============================================================================

Deno.test('CreateApiKeySchema - should validate minimal api key', () => {
    const result = CreateApiKeySchema.safeParse({
        userId: VALID_UUID,
        name: 'My Key',
    });
    assertEquals(result.success, true);
    if (result.success) {
        assertEquals(result.data.scopes, ['compile']);
        assertEquals(result.data.rateLimitPerMinute, 60);
    }
});

Deno.test('CreateApiKeySchema - should validate full api key', () => {
    const result = CreateApiKeySchema.safeParse({
        userId: VALID_UUID,
        name: 'Admin Key',
        scopes: ['compile', 'admin'],
        rateLimitPerMinute: 100,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    assertEquals(result.success, true);
});

Deno.test('CreateApiKeySchema - should reject empty name', () => {
    const result = CreateApiKeySchema.safeParse({ userId: VALID_UUID, name: '' });
    assertEquals(result.success, false);
});

Deno.test('CreateApiKeySchema - should reject empty scopes array', () => {
    const result = CreateApiKeySchema.safeParse({ userId: VALID_UUID, name: 'Key', scopes: [] });
    assertEquals(result.success, false);
});

Deno.test('CreateApiKeySchema - should reject invalid userId', () => {
    const result = CreateApiKeySchema.safeParse({ userId: 'not-a-uuid', name: 'Key' });
    assertEquals(result.success, false);
});

// ============================================================================
// CreateSessionSchema
// ============================================================================

Deno.test('CreateSessionSchema - should validate minimal session', () => {
    const result = CreateSessionSchema.safeParse({
        userId: VALID_UUID,
        tokenHash: VALID_HASH,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    assertEquals(result.success, true);
});

Deno.test('CreateSessionSchema - should validate full session', () => {
    const result = CreateSessionSchema.safeParse({
        userId: VALID_UUID,
        tokenHash: VALID_HASH,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    assertEquals(result.success, true);
});

Deno.test('CreateSessionSchema - should reject short tokenHash', () => {
    const result = CreateSessionSchema.safeParse({
        userId: VALID_UUID,
        tokenHash: 'short',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    assertEquals(result.success, false);
});

// ============================================================================
// CreateFilterSourceSchema
// ============================================================================

Deno.test('CreateFilterSourceSchema - should validate minimal filter source', () => {
    const result = CreateFilterSourceSchema.safeParse({
        url: VALID_URL,
        name: 'EasyList',
    });
    assertEquals(result.success, true);
    if (result.success) {
        assertEquals(result.data.isPublic, true);
        assertEquals(result.data.refreshIntervalSeconds, 3600);
    }
});

Deno.test('CreateFilterSourceSchema - should validate full filter source', () => {
    const result = CreateFilterSourceSchema.safeParse({
        url: VALID_URL,
        name: 'EasyList',
        description: 'Primary ads filter',
        homepage: 'https://easylist.to',
        license: 'GPL-3.0',
        isPublic: false,
        ownerUserId: VALID_UUID,
        refreshIntervalSeconds: 7200,
    });
    assertEquals(result.success, true);
});

Deno.test('CreateFilterSourceSchema - should reject invalid URL', () => {
    const result = CreateFilterSourceSchema.safeParse({ url: 'not-a-url', name: 'Test' });
    assertEquals(result.success, false);
});

Deno.test('CreateFilterSourceSchema - should reject refreshInterval below minimum', () => {
    const result = CreateFilterSourceSchema.safeParse({ url: VALID_URL, name: 'Test', refreshIntervalSeconds: 30 });
    assertEquals(result.success, false);
});

// ============================================================================
// CreateFilterListVersionSchema
// ============================================================================

Deno.test('CreateFilterListVersionSchema - should validate minimal version', () => {
    const result = CreateFilterListVersionSchema.safeParse({
        sourceId: VALID_UUID,
        contentHash: VALID_HASH,
        ruleCount: 100,
        r2Key: 'versions/abc123.txt',
    });
    assertEquals(result.success, true);
    if (result.success) {
        assertEquals(result.data.isCurrent, false);
    }
});

Deno.test('CreateFilterListVersionSchema - should validate current version', () => {
    const result = CreateFilterListVersionSchema.safeParse({
        sourceId: VALID_UUID,
        contentHash: VALID_HASH,
        ruleCount: 50000,
        r2Key: 'versions/current.txt',
        isCurrent: true,
    });
    assertEquals(result.success, true);
});

Deno.test('CreateFilterListVersionSchema - should reject negative ruleCount', () => {
    const result = CreateFilterListVersionSchema.safeParse({
        sourceId: VALID_UUID,
        contentHash: VALID_HASH,
        ruleCount: -1,
        r2Key: 'versions/abc.txt',
    });
    assertEquals(result.success, false);
});

// ============================================================================
// CreateCompiledOutputSchema
// ============================================================================

Deno.test('CreateCompiledOutputSchema - should validate compiled output', () => {
    const result = CreateCompiledOutputSchema.safeParse({
        configHash: VALID_HASH,
        configName: 'default',
        configSnapshot: { name: 'default', sources: [] },
        ruleCount: 75000,
        sourceCount: 3,
        durationMs: 1200,
        r2Key: 'outputs/abc123.txt',
    });
    assertEquals(result.success, true);
});

Deno.test('CreateCompiledOutputSchema - should reject sourceCount of zero', () => {
    const result = CreateCompiledOutputSchema.safeParse({
        configHash: VALID_HASH,
        configName: 'default',
        configSnapshot: {},
        ruleCount: 0,
        sourceCount: 0,
        durationMs: 0,
        r2Key: 'outputs/abc.txt',
    });
    assertEquals(result.success, false);
});

Deno.test('CreateCompiledOutputSchema - should reject negative durationMs', () => {
    const result = CreateCompiledOutputSchema.safeParse({
        configHash: VALID_HASH,
        configName: 'default',
        configSnapshot: {},
        ruleCount: 0,
        sourceCount: 1,
        durationMs: -1,
        r2Key: 'outputs/abc.txt',
    });
    assertEquals(result.success, false);
});

// ============================================================================
// CreateCompilationEventSchema
// ============================================================================

Deno.test('CreateCompilationEventSchema - should validate minimal event', () => {
    const result = CreateCompilationEventSchema.safeParse({
        requestSource: 'worker',
        durationMs: 500,
    });
    assertEquals(result.success, true);
    if (result.success) {
        assertEquals(result.data.cacheHit, false);
    }
});

Deno.test('CreateCompilationEventSchema - should validate full event', () => {
    const result = CreateCompilationEventSchema.safeParse({
        compiledOutputId: VALID_UUID,
        userId: VALID_UUID,
        apiKeyId: VALID_UUID,
        requestSource: 'cli',
        workerRegion: 'enam',
        durationMs: 1000,
        cacheHit: true,
    });
    assertEquals(result.success, true);
});

Deno.test('CreateCompilationEventSchema - should reject invalid requestSource', () => {
    const result = CreateCompilationEventSchema.safeParse({ requestSource: 'browser', durationMs: 100 });
    assertEquals(result.success, false);
});

// ============================================================================
// CreateSourceHealthSnapshotSchema
// ============================================================================

Deno.test('CreateSourceHealthSnapshotSchema - should validate health snapshot', () => {
    const result = CreateSourceHealthSnapshotSchema.safeParse({
        sourceId: VALID_UUID,
        status: 'healthy',
    });
    assertEquals(result.success, true);
    if (result.success) {
        assertEquals(result.data.totalAttempts, 0);
        assertEquals(result.data.avgDurationMs, 0);
    }
});

Deno.test('CreateSourceHealthSnapshotSchema - should reject unknown status', () => {
    const result = CreateSourceHealthSnapshotSchema.safeParse({ sourceId: VALID_UUID, status: 'unknown' });
    assertEquals(result.success, false);
});

Deno.test('CreateSourceHealthSnapshotSchema - should reject negative attempts', () => {
    const result = CreateSourceHealthSnapshotSchema.safeParse({
        sourceId: VALID_UUID,
        status: 'healthy',
        totalAttempts: -1,
    });
    assertEquals(result.success, false);
});

// ============================================================================
// CreateSourceChangeEventSchema
// ============================================================================

Deno.test('CreateSourceChangeEventSchema - should validate minimal change event', () => {
    const result = CreateSourceChangeEventSchema.safeParse({
        sourceId: VALID_UUID,
        newVersionId: VALID_UUID,
    });
    assertEquals(result.success, true);
    if (result.success) {
        assertEquals(result.data.ruleCountDelta, 0);
        assertEquals(result.data.contentHashChanged, true);
    }
});

Deno.test('CreateSourceChangeEventSchema - should validate full change event', () => {
    const result = CreateSourceChangeEventSchema.safeParse({
        sourceId: VALID_UUID,
        previousVersionId: VALID_UUID,
        newVersionId: VALID_UUID,
        ruleCountDelta: -500,
        contentHashChanged: false,
    });
    assertEquals(result.success, true);
});

Deno.test('CreateSourceChangeEventSchema - should reject invalid newVersionId', () => {
    const result = CreateSourceChangeEventSchema.safeParse({
        sourceId: VALID_UUID,
        newVersionId: 'not-a-uuid',
    });
    assertEquals(result.success, false);
});
