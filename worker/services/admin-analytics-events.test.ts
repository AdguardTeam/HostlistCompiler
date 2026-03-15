/**
 * Tests for Admin Analytics Events — fire-and-forget helpers for Analytics Engine.
 *
 * Covers:
 *   - trackAdminAction() — writes correct data point shape
 *   - trackAdminAuthFailure() — writes failure event
 *   - trackAdminConfigChange() — writes config change event
 *   - trackFeatureFlagEvaluation() — writes flag eval event
 *   - All functions are no-op when ANALYTICS_ENGINE is undefined (no throw)
 */

import { assertEquals, assertExists } from '@std/assert';
import { trackAdminAction, trackAdminAuthFailure, trackAdminConfigChange, trackFeatureFlagEvaluation } from './admin-analytics-events.ts';
import type { Env } from '../types.ts';

// ============================================================================
// Mock factories
// ============================================================================

interface CapturedDataPoint {
    indexes: string[];
    doubles: number[];
    blobs: (string | null)[];
}

/** Create a mock Env with ANALYTICS_ENGINE that captures writeDataPoint calls. */
function createMockEnv(): { env: Env; captured: CapturedDataPoint[] } {
    const captured: CapturedDataPoint[] = [];
    const env = {
        ANALYTICS_ENGINE: {
            writeDataPoint: (dp: CapturedDataPoint) => {
                captured.push(dp);
            },
        },
    } as unknown as Env;
    return { env, captured };
}

/** Create a mock Env without ANALYTICS_ENGINE. */
function createEnvWithoutAnalytics(): Env {
    return {} as unknown as Env;
}

// ============================================================================
// trackAdminAction
// ============================================================================

Deno.test('trackAdminAction - writes correct data point shape', () => {
    const { env, captured } = createMockEnv();

    trackAdminAction(env, {
        action: 'role.assign',
        resourceType: 'admin_role',
        resourceId: 'editor',
        actorId: 'user_admin',
        ip: '10.0.0.1',
        success: true,
        metadata: { key: 'value' },
    });

    assertEquals(captured.length, 1);
    const dp = captured[0];
    assertEquals(dp.indexes[0], 'admin_action');
    assertEquals(dp.doubles[0], 1); // success = true → 1
    assertEquals(dp.blobs[0], 'role.assign'); // action
    assertEquals(dp.blobs[1], 'admin_role'); // resourceType
    assertEquals(dp.blobs[2], 'editor'); // resourceId
    // blobs[3] is hashed IP — just verify it's a string starting with 'ip_'
    assertExists(dp.blobs[3]);
    assertEquals(dp.blobs[3]!.startsWith('ip_'), true);
    assertEquals(dp.blobs[4], 'user_admin'); // actorId
    assertEquals(dp.blobs[5], JSON.stringify({ key: 'value' })); // metadata
    // blobs[6] is ISO timestamp
    assertExists(dp.blobs[6]);
});

Deno.test('trackAdminAction - failure event writes 0', () => {
    const { env, captured } = createMockEnv();

    trackAdminAction(env, {
        action: 'role.assign',
        resourceType: 'admin_role',
        resourceId: 'editor',
        actorId: 'user_admin',
        ip: '10.0.0.1',
        success: false,
    });

    assertEquals(captured[0].doubles[0], 0);
    assertEquals(captured[0].blobs[5], null); // no metadata
});

Deno.test('trackAdminAction - no-op when ANALYTICS_ENGINE undefined', () => {
    const env = createEnvWithoutAnalytics();
    // Should not throw
    trackAdminAction(env, {
        action: 'test',
        resourceType: 'test',
        resourceId: 'test',
        actorId: 'test',
        ip: '0.0.0.0',
        success: true,
    });
});

// ============================================================================
// trackAdminAuthFailure
// ============================================================================

Deno.test('trackAdminAuthFailure - writes failure event', () => {
    const { env, captured } = createMockEnv();

    trackAdminAuthFailure(env, {
        reason: 'Missing token',
        requiredPermission: 'admin:write',
        actorId: 'user_abc',
        ip: '10.0.0.2',
        endpoint: '/admin/roles',
    });

    assertEquals(captured.length, 1);
    const dp = captured[0];
    assertEquals(dp.indexes[0], 'admin_auth_failure');
    assertEquals(dp.doubles[0], 0); // always failure
    assertEquals(dp.blobs[0], 'Missing token');
    assertEquals(dp.blobs[1], 'admin:write');
    assertEquals(dp.blobs[2], 'user_abc');
    assertEquals(dp.blobs[4], '/admin/roles');
});

Deno.test('trackAdminAuthFailure - handles optional fields as null', () => {
    const { env, captured } = createMockEnv();

    trackAdminAuthFailure(env, {
        reason: 'Expired',
        ip: '10.0.0.3',
        endpoint: '/admin/config',
    });

    assertEquals(captured[0].blobs[1], null); // requiredPermission
    assertEquals(captured[0].blobs[2], null); // actorId
});

Deno.test('trackAdminAuthFailure - no-op when ANALYTICS_ENGINE undefined', () => {
    const env = createEnvWithoutAnalytics();
    trackAdminAuthFailure(env, {
        reason: 'test',
        ip: '0.0.0.0',
        endpoint: '/test',
    });
});

// ============================================================================
// trackAdminConfigChange
// ============================================================================

Deno.test('trackAdminConfigChange - writes config change event', () => {
    const { env, captured } = createMockEnv();

    trackAdminConfigChange(env, {
        configType: 'tier',
        action: 'update',
        configId: 'pro',
        actorId: 'user_admin',
    });

    assertEquals(captured.length, 1);
    const dp = captured[0];
    assertEquals(dp.indexes[0], 'admin_config_change');
    assertEquals(dp.doubles[0], 1); // success
    assertEquals(dp.blobs[0], 'tier');
    assertEquals(dp.blobs[1], 'update');
    assertEquals(dp.blobs[2], 'pro');
    assertEquals(dp.blobs[3], 'user_admin');
});

Deno.test('trackAdminConfigChange - no-op when ANALYTICS_ENGINE undefined', () => {
    const env = createEnvWithoutAnalytics();
    trackAdminConfigChange(env, {
        configType: 'flag',
        action: 'create',
        configId: 'test',
        actorId: 'test',
    });
});

// ============================================================================
// trackFeatureFlagEvaluation
// ============================================================================

Deno.test('trackFeatureFlagEvaluation - writes flag eval event (true)', () => {
    const { env, captured } = createMockEnv();

    trackFeatureFlagEvaluation(env, {
        flagName: 'dark-mode',
        result: true,
        tier: 'pro',
        userId: 'user_abc',
    });

    assertEquals(captured.length, 1);
    const dp = captured[0];
    assertEquals(dp.indexes[0], 'flag_evaluation');
    assertEquals(dp.doubles[0], 1); // true → 1
    assertEquals(dp.blobs[0], 'dark-mode');
    assertEquals(dp.blobs[1], 'pro');
    assertEquals(dp.blobs[2], 'user_abc');
});

Deno.test('trackFeatureFlagEvaluation - writes flag eval event (false)', () => {
    const { env, captured } = createMockEnv();

    trackFeatureFlagEvaluation(env, {
        flagName: 'beta',
        result: false,
    });

    assertEquals(captured[0].doubles[0], 0);
    assertEquals(captured[0].blobs[1], null); // tier
    assertEquals(captured[0].blobs[2], null); // userId
});

Deno.test('trackFeatureFlagEvaluation - no-op when ANALYTICS_ENGINE undefined', () => {
    const env = createEnvWithoutAnalytics();
    trackFeatureFlagEvaluation(env, {
        flagName: 'test',
        result: true,
    });
});

// ============================================================================
// Error safety — writeDataPoint throws
// ============================================================================

Deno.test('safeWrite - swallows errors from writeDataPoint', () => {
    const env = {
        ANALYTICS_ENGINE: {
            writeDataPoint: () => {
                throw new Error('Analytics engine down');
            },
        },
    } as unknown as Env;

    // None of these should throw
    trackAdminAction(env, {
        action: 'test',
        resourceType: 'test',
        resourceId: 'test',
        actorId: 'test',
        ip: '0.0.0.0',
        success: true,
    });

    trackAdminAuthFailure(env, {
        reason: 'test',
        ip: '0.0.0.0',
        endpoint: '/test',
    });

    trackAdminConfigChange(env, {
        configType: 'tier',
        action: 'create',
        configId: 'test',
        actorId: 'test',
    });

    trackFeatureFlagEvaluation(env, {
        flagName: 'test',
        result: true,
    });
});
