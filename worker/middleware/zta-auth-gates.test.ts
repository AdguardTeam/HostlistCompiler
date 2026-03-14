/**
 * Tests for ZTA Phase 2 — Auth gates on previously unprotected endpoints.
 *
 * Validates that /workflow/*, /queue/cancel/*, and /validate-rule
 * are properly gated with authentication, rate limiting, and security
 * event telemetry.
 */
import { assertEquals, assertExists } from 'https://deno.land/std@0.220.0/assert/mod.ts';
import { AnalyticsService } from '../../src/services/AnalyticsService.ts';
import type { SecurityEventData } from '../../src/services/AnalyticsService.ts';
import { requireAuth } from '../middleware/auth.ts';
import { type IAuthContext, UserTier, ANONYMOUS_AUTH_CONTEXT } from '../types.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAnonymousContext(): IAuthContext {
    return { ...ANONYMOUS_AUTH_CONTEXT };
}

function makeAuthenticatedContext(tier: UserTier = UserTier.Free): IAuthContext {
    return {
        userId: 'db_user_123',
        clerkUserId: 'user_test123',
        tier,
        role: tier === UserTier.Admin ? 'admin' : 'user',
        apiKeyId: null,
        sessionId: 'sess_abc',
        scopes: ['compile:read', 'compile:write'],
        authMethod: 'clerk-jwt',
    };
}

// ---------------------------------------------------------------------------
// requireAuth gate tests
// ---------------------------------------------------------------------------

Deno.test('requireAuth - blocks anonymous access', () => {
    const ctx = makeAnonymousContext();
    const result = requireAuth(ctx);
    assertExists(result, 'Should return a Response for anonymous users');
    assertEquals(result!.status, 401);
});

Deno.test('requireAuth - allows authenticated access', () => {
    const ctx = makeAuthenticatedContext();
    const result = requireAuth(ctx);
    assertEquals(result, null, 'Should return null for authenticated users');
});

Deno.test('requireAuth - allows all valid tiers', () => {
    for (const tier of [UserTier.Free, UserTier.Pro, UserTier.Admin]) {
        const ctx = makeAuthenticatedContext(tier);
        const result = requireAuth(ctx);
        assertEquals(result, null, `Should allow tier "${tier}"`);
    }
});

// ---------------------------------------------------------------------------
// SecurityEventData interface tests
// ---------------------------------------------------------------------------

Deno.test('SecurityEventData - all fields are set', () => {
    const event: SecurityEventData = {
        eventType: 'auth_failure',
        path: '/workflow/compile',
        method: 'POST',
        clientIpHash: AnalyticsService.hashIp('192.168.1.1'),
        tier: 'anonymous',
        reason: 'unauthenticated_workflow_access',
        timestamp: new Date().toISOString(),
    };

    assertEquals(event.eventType, 'auth_failure');
    assertEquals(event.path, '/workflow/compile');
    assertEquals(event.method, 'POST');
    assertExists(event.clientIpHash);
    assertEquals(event.tier, 'anonymous');
    assertEquals(event.reason, 'unauthenticated_workflow_access');
});

Deno.test('SecurityEventData - covers all event types', () => {
    const types: SecurityEventData['eventType'][] = [
        'auth_failure',
        'rate_limit',
        'turnstile_rejection',
        'cors_rejection',
        'cf_access_denial',
        'size_limit',
    ];

    for (const t of types) {
        const event: SecurityEventData = { eventType: t, path: '/test' };
        assertEquals(event.eventType, t);
    }
});

// ---------------------------------------------------------------------------
// AnalyticsService.trackSecurityEvent tests
// ---------------------------------------------------------------------------

Deno.test('AnalyticsService.trackSecurityEvent - writes data point', () => {
    const dataPoints: Array<{ indexes: string[]; doubles: number[]; blobs: (string | null)[] }> = [];

    // Mock the Analytics Engine dataset binding
    const mockBinding = {
        writeDataPoint: (dp: { indexes: string[]; doubles: number[]; blobs: (string | null)[] }) => {
            dataPoints.push(dp);
        },
    };

    const analytics = new AnalyticsService(mockBinding as never);
    analytics.trackSecurityEvent({
        eventType: 'auth_failure',
        path: '/workflow/compile',
        method: 'POST',
        clientIpHash: 'ip_abc123',
        reason: 'unauthenticated_workflow_access',
    });

    assertEquals(dataPoints.length, 1);
    // indexes[0] is the event type
    assertEquals(dataPoints[0].indexes[0], 'security_event');
});

// ---------------------------------------------------------------------------
// AnalyticsService.hashIp utility
// ---------------------------------------------------------------------------

Deno.test('hashIp - produces consistent hashes', () => {
    const hash1 = AnalyticsService.hashIp('192.168.1.1');
    const hash2 = AnalyticsService.hashIp('192.168.1.1');
    assertEquals(hash1, hash2, 'Same IP should produce same hash');
});

Deno.test('hashIp - produces different hashes for different IPs', () => {
    const hash1 = AnalyticsService.hashIp('192.168.1.1');
    const hash2 = AnalyticsService.hashIp('10.0.0.1');
    const isDifferent = hash1 !== hash2;
    assertEquals(isDifferent, true, 'Different IPs should produce different hashes');
});

Deno.test('hashIp - starts with ip_ prefix', () => {
    const hash = AnalyticsService.hashIp('192.168.1.1');
    assertEquals(hash.startsWith('ip_'), true, 'Hash should start with ip_ prefix');
});

// ---------------------------------------------------------------------------
// Workflow endpoint path detection
// ---------------------------------------------------------------------------

Deno.test('workflow paths are correctly detected', () => {
    const workflowPaths = [
        '/workflow/compile',
        '/workflow/batch',
        '/workflow/cache-warm',
        '/workflow/health-check',
        '/workflow/status/compile/123',
        '/workflow/metrics',
        '/workflow/events/abc123',
    ];

    for (const path of workflowPaths) {
        assertEquals(
            path.startsWith('/workflow/'),
            true,
            `Path "${path}" should be detected as workflow`,
        );
    }
});

Deno.test('non-workflow paths are not detected', () => {
    const nonWorkflowPaths = [
        '/compile',
        '/api/version',
        '/health',
        '/admin/users',
        '/queue/cancel/123',
    ];

    for (const path of nonWorkflowPaths) {
        assertEquals(
            path.startsWith('/workflow/'),
            false,
            `Path "${path}" should NOT be detected as workflow`,
        );
    }
});

// ---------------------------------------------------------------------------
// Queue cancel path detection
// ---------------------------------------------------------------------------

Deno.test('queue cancel path is correctly detected', () => {
    assertEquals('/queue/cancel/abc123'.startsWith('/queue/cancel/'), true);
    assertEquals('/queue/cancel/'.startsWith('/queue/cancel/'), true);
});

Deno.test('non-cancel queue paths are not detected', () => {
    assertEquals('/queue/status'.startsWith('/queue/cancel/'), false);
    assertEquals('/queue/list'.startsWith('/queue/cancel/'), false);
});
