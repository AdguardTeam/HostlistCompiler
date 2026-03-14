/**
 * Tests for Admin Logger — structured logging utilities.
 *
 * Covers:
 *   - createRequestId() — generates short unique hex IDs
 *   - createAdminLogger() — structured JSON log emission at info/warn/error
 *   - withOperation() / withActor() — immutable logger chaining
 *   - startTimer() — elapsed() timing
 *   - withAdminTracing() — wraps fn, logs start/end, re-throws errors
 *   - sanitizeForLog() — deep redaction of sensitive keys
 */

import { assertEquals } from '@std/assert';
import { createAdminLogger, createRequestId, sanitizeForLog, startTimer, withAdminTracing } from './admin-logger';

// ============================================================================
// Helpers
// ============================================================================

/** Capture console.log output during a synchronous callback. */
function captureLog(fn: () => void): string[] {
    const captured: string[] = [];
    const original = console.log;
    console.log = (msg: string) => captured.push(msg);
    try {
        fn();
    } finally {
        console.log = original;
    }
    return captured;
}

/** Capture console.log output during an async callback. */
async function captureLogAsync(fn: () => Promise<unknown>): Promise<string[]> {
    const captured: string[] = [];
    const original = console.log;
    console.log = (msg: string) => captured.push(msg);
    try {
        await fn();
    } finally {
        console.log = original;
    }
    return captured;
}

// ============================================================================
// createRequestId
// ============================================================================

Deno.test('createRequestId - returns an 8-character string', () => {
    const id = createRequestId();
    assertEquals(id.length, 8);
});

Deno.test('createRequestId - returns different values on successive calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => createRequestId()));
    assertEquals(ids.size > 1, true);
});

// ============================================================================
// createAdminLogger
// ============================================================================

Deno.test('createAdminLogger - info emits valid JSON to console', () => {
    const logs = captureLog(() => {
        const logger = createAdminLogger('abc12345');
        logger.info('hello world');
    });
    assertEquals(logs.length, 1);
    const entry = JSON.parse(logs[0]);
    assertEquals(entry.level, 'info');
    assertEquals(entry.message, 'hello world');
    assertEquals(entry.requestId, 'abc12345');
});

Deno.test('createAdminLogger - warn emits level=warn', () => {
    const logs = captureLog(() => {
        createAdminLogger('test1234').warn('watch out');
    });
    const entry = JSON.parse(logs[0]);
    assertEquals(entry.level, 'warn');
    assertEquals(entry.message, 'watch out');
});

Deno.test('createAdminLogger - error emits level=error', () => {
    const logs = captureLog(() => {
        createAdminLogger('test1234').error('something broke');
    });
    const entry = JSON.parse(logs[0]);
    assertEquals(entry.level, 'error');
    assertEquals(entry.message, 'something broke');
});

Deno.test('createAdminLogger - includes timestamp in output', () => {
    const logs = captureLog(() => {
        createAdminLogger('ts123456').info('timestamped');
    });
    const entry = JSON.parse(logs[0]);
    assertEquals(typeof entry.timestamp, 'string');
});

Deno.test('createAdminLogger - withOperation returns new logger with operation set', () => {
    const logs = captureLog(() => {
        createAdminLogger('op123456').withOperation('tier.update').info('updated');
    });
    const entry = JSON.parse(logs[0]);
    assertEquals(entry.operation, 'tier.update');
});

Deno.test('createAdminLogger - withActor returns new logger with actorId set', () => {
    const logs = captureLog(() => {
        createAdminLogger('ac123456').withActor('user_abc').info('acted');
    });
    const entry = JSON.parse(logs[0]);
    assertEquals(entry.actorId, 'user_abc');
});

Deno.test('createAdminLogger - chaining withOperation and withActor preserves both fields', () => {
    const logs = captureLog(() => {
        createAdminLogger('ch123456')
            .withOperation('role.assign')
            .withActor('user_xyz')
            .info('chained');
    });
    const entry = JSON.parse(logs[0]);
    assertEquals(entry.operation, 'role.assign');
    assertEquals(entry.actorId, 'user_xyz');
});

Deno.test('createAdminLogger - extra fields passed to info() appear in output', () => {
    const logs = captureLog(() => {
        createAdminLogger('ex123456').info('with fields', {
            resourceType: 'tier_config',
            resourceId: 'pro',
            status: 'success',
        });
    });
    const entry = JSON.parse(logs[0]);
    assertEquals(entry.resourceType, 'tier_config');
    assertEquals(entry.resourceId, 'pro');
    assertEquals(entry.status, 'success');
});

Deno.test('createAdminLogger - original logger not mutated by withOperation', () => {
    const base = createAdminLogger('mut12345');
    base.withOperation('role.list');
    const logs = captureLog(() => base.info('base log'));
    const entry = JSON.parse(logs[0]);
    assertEquals(entry.operation, undefined);
});

// ============================================================================
// startTimer
// ============================================================================

Deno.test('startTimer - elapsed() returns non-negative number', () => {
    const timer = startTimer();
    assertEquals(timer.elapsed() >= 0, true);
});

Deno.test('startTimer - elapsed() increases over time', async () => {
    const timer = startTimer();
    await new Promise((r) => setTimeout(r, 20));
    assertEquals(timer.elapsed() >= 10, true);
});

// ============================================================================
// withAdminTracing
// ============================================================================

Deno.test('withAdminTracing - returns result of wrapped fn', async () => {
    const logger = createAdminLogger('tr123456');
    const result = await captureLogAsync(async () => {
        const val = await withAdminTracing(logger, 'test.op', async () => 42);
        assertEquals(val, 42);
    });
    assertEquals(result.length >= 2, true); // start + completion log
});

Deno.test('withAdminTracing - logs start and completion entries', async () => {
    const logger = createAdminLogger('tc123456');
    const logs = await captureLogAsync(() => withAdminTracing(logger, 'scope.list', async () => 'done'));
    assertEquals(logs.length, 2);
    const start = JSON.parse(logs[0]);
    const end = JSON.parse(logs[1]);
    assertEquals(start.operation, 'scope.list');
    assertEquals(end.status, 'success');
});

Deno.test('withAdminTracing - re-throws errors from wrapped fn', async () => {
    const logger = createAdminLogger('er123456');
    let threw = false;
    const logs = await captureLogAsync(async () => {
        try {
            await withAdminTracing(logger, 'fail.op', async () => {
                throw new Error('boom');
            });
        } catch {
            threw = true;
        }
    });
    assertEquals(threw, true);
    const errorEntry = JSON.parse(logs[logs.length - 1]);
    assertEquals(errorEntry.status, 'error');
    assertEquals(errorEntry.error, 'boom');
});

// ============================================================================
// sanitizeForLog
// ============================================================================

Deno.test('sanitizeForLog - returns primitives unchanged', () => {
    assertEquals(sanitizeForLog(42), 42);
    assertEquals(sanitizeForLog('hello'), 'hello');
    assertEquals(sanitizeForLog(true), true);
});

Deno.test('sanitizeForLog - returns null unchanged', () => {
    assertEquals(sanitizeForLog(null), null);
});

Deno.test('sanitizeForLog - returns undefined unchanged', () => {
    assertEquals(sanitizeForLog(undefined), undefined);
});

Deno.test('sanitizeForLog - redacts password key', () => {
    const result = sanitizeForLog({ user: 'alice', password: 's3cr3t' }) as Record<string, unknown>;
    assertEquals(result.password, '[REDACTED]');
    assertEquals(result.user, 'alice');
});

Deno.test('sanitizeForLog - redacts secret key', () => {
    const result = sanitizeForLog({ secret: 'sk_live_abc' }) as Record<string, unknown>;
    assertEquals(result.secret, '[REDACTED]');
});

Deno.test('sanitizeForLog - redacts token key', () => {
    const result = sanitizeForLog({ token: 'tok_123' }) as Record<string, unknown>;
    assertEquals(result.token, '[REDACTED]');
});

Deno.test('sanitizeForLog - redacts key key', () => {
    const result = sanitizeForLog({ key: 'api_key_xyz' }) as Record<string, unknown>;
    assertEquals(result.key, '[REDACTED]');
});

Deno.test('sanitizeForLog - redacts authorization key', () => {
    const result = sanitizeForLog({ authorization: 'Bearer abc' }) as Record<string, unknown>;
    assertEquals(result.authorization, '[REDACTED]');
});

Deno.test('sanitizeForLog - case-insensitive redaction (PASSWORD, TOKEN)', () => {
    const result = sanitizeForLog({ PASSWORD: 'x', TOKEN: 'y', name: 'z' }) as Record<string, unknown>;
    assertEquals(result.PASSWORD, '[REDACTED]');
    assertEquals(result.TOKEN, '[REDACTED]');
    assertEquals(result.name, 'z');
});

Deno.test('sanitizeForLog - does not redact non-sensitive keys', () => {
    const result = sanitizeForLog({ userId: 'u1', action: 'list' }) as Record<string, unknown>;
    assertEquals(result.userId, 'u1');
    assertEquals(result.action, 'list');
});

Deno.test('sanitizeForLog - recursively sanitizes nested objects', () => {
    const result = sanitizeForLog({ outer: { inner: { password: 'hidden' } } }) as Record<string, Record<string, Record<string, unknown>>>;
    assertEquals(result.outer.inner.password, '[REDACTED]');
});

Deno.test('sanitizeForLog - sanitizes values inside arrays', () => {
    const result = sanitizeForLog([{ token: 'abc' }, { name: 'bob' }]) as Array<Record<string, unknown>>;
    assertEquals(result[0].token, '[REDACTED]');
    assertEquals(result[1].name, 'bob');
});

Deno.test('sanitizeForLog - handles empty object', () => {
    assertEquals(sanitizeForLog({}), {});
});
