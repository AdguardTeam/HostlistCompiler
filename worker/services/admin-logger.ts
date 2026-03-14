/**
 * Admin structured logging utilities for Cloudflare Worker.
 * Provides request-scoped structured logging, operation timing,
 * automatic tracing, and log sanitization for all admin operations.
 *
 * All output is structured JSON via console.log — Cloudflare Workers
 * captures console output to Workers Logs automatically.
 *
 * @example
 * ```ts
 * const requestId = createRequestId();
 * const logger = createAdminLogger(requestId)
 *     .withOperation('role.assign')
 *     .withActor('user_abc123');
 *
 * await withAdminTracing(logger, 'role.assign', async () => {
 *     // ... perform admin work
 * });
 * ```
 */

// ============================================================================
// Types
// ============================================================================

/** Structured fields attached to every admin log entry. */
export interface AdminLogFields {
    /** Unique identifier for this request (generated per-request). */
    requestId: string;
    /** The admin operation being performed (e.g. 'role.assign', 'tier.update'). */
    operation: string;
    /** Clerk user ID of the actor performing the operation. */
    actorId?: string;
    /** Type of resource being acted upon (e.g. 'tier_config', 'user'). */
    resourceType?: string;
    /** Identifier of the specific resource. */
    resourceId?: string;
    /** Duration of the operation in milliseconds. */
    durationMs?: number;
    /** Outcome of the operation. */
    status?: 'success' | 'error' | 'denied';
    /** Error message if the operation failed. */
    error?: string;
    /** Extensible — additional context fields. */
    [key: string]: unknown;
}

/** Log severity level. */
type LogLevel = 'info' | 'warn' | 'error';

/** Structured admin logger instance returned by {@link createAdminLogger}. */
export interface AdminLogger {
    /** Log at info level. */
    info(message: string, fields?: Partial<AdminLogFields>): void;
    /** Log at warn level. */
    warn(message: string, fields?: Partial<AdminLogFields>): void;
    /** Log at error level. */
    error(message: string, fields?: Partial<AdminLogFields>): void;
    /** Return a new logger with the given operation pre-set. */
    withOperation(operation: string): AdminLogger;
    /** Return a new logger with the given actor pre-set. */
    withActor(actorId: string): AdminLogger;
}

/** Timer handle returned by {@link startTimer}. */
export interface AdminTimer {
    /** Returns milliseconds elapsed since the timer was created. */
    elapsed(): number;
}

// ============================================================================
// Sensitive Key Pattern
// ============================================================================

/**
 * Pattern matching keys whose values must be redacted before logging.
 * Matches: password, secret, token, key, authorization (case-insensitive).
 */
const SENSITIVE_KEY_PATTERN = /^(password|secret|token|key|authorization)$/i;

// ============================================================================
// Request ID
// ============================================================================

/**
 * Generates a short unique request ID for tracing admin operations.
 * Uses the first 8 characters of a v4 UUID.
 *
 * @returns An 8-character hex string (e.g. 'a1b2c3d4')
 */
export function createRequestId(): string {
    return crypto.randomUUID().slice(0, 8);
}

// ============================================================================
// Admin Logger
// ============================================================================

/**
 * Writes a single structured log entry to console as JSON.
 * Cloudflare Workers captures console output to Workers Logs.
 *
 * @param level - Log severity
 * @param requestId - Request-scoped trace ID
 * @param message - Human-readable log message
 * @param baseFields - Pre-set fields from the logger instance
 * @param extraFields - Per-call override fields
 */
function emitLog(
    level: LogLevel,
    requestId: string,
    message: string,
    baseFields: Partial<AdminLogFields>,
    extraFields?: Partial<AdminLogFields>,
): void {
    const entry = {
        level,
        requestId,
        ...baseFields,
        ...extraFields,
        message,
        timestamp: new Date().toISOString(),
    };

    // deno-lint-ignore no-console
    console.log(JSON.stringify(entry));
}

/**
 * Creates a structured admin logger scoped to a single request.
 *
 * The returned logger is immutable — {@link AdminLogger.withOperation} and
 * {@link AdminLogger.withActor} return new logger instances rather than
 * mutating the original.
 *
 * @param requestId - Unique request identifier (use {@link createRequestId})
 * @param baseFields - Optional pre-set fields carried on every log entry
 * @returns An {@link AdminLogger} instance
 *
 * @example
 * ```ts
 * const logger = createAdminLogger(createRequestId());
 * logger.info('Request started');
 *
 * const scoped = logger.withOperation('tier.update').withActor('user_42');
 * scoped.info('Updating tier', { resourceType: 'tier_config', resourceId: 'pro' });
 * ```
 */
export function createAdminLogger(
    requestId: string,
    baseFields: Partial<AdminLogFields> = {},
): AdminLogger {
    return {
        info(message: string, fields?: Partial<AdminLogFields>): void {
            emitLog('info', requestId, message, baseFields, fields);
        },

        warn(message: string, fields?: Partial<AdminLogFields>): void {
            emitLog('warn', requestId, message, baseFields, fields);
        },

        error(message: string, fields?: Partial<AdminLogFields>): void {
            emitLog('error', requestId, message, baseFields, fields);
        },

        withOperation(operation: string): AdminLogger {
            return createAdminLogger(requestId, { ...baseFields, operation });
        },

        withActor(actorId: string): AdminLogger {
            return createAdminLogger(requestId, { ...baseFields, actorId });
        },
    };
}

// ============================================================================
// Admin Timer
// ============================================================================

/**
 * Creates a high-resolution timer for measuring operation duration.
 * Uses {@link performance.now} for sub-millisecond accuracy.
 *
 * @returns An {@link AdminTimer} with an `elapsed()` method
 *
 * @example
 * ```ts
 * const timer = startTimer();
 * await doExpensiveWork();
 * logger.info('Work complete', { durationMs: timer.elapsed() });
 * ```
 */
export function startTimer(): AdminTimer {
    const start = performance.now();
    return {
        elapsed(): number {
            return Math.round(performance.now() - start);
        },
    };
}

// ============================================================================
// Admin Tracing Wrapper
// ============================================================================

/**
 * Wraps an async admin operation with automatic structured tracing.
 *
 * Logs the operation start, measures duration, and logs the outcome
 * (success or error) with timing information. On error the original
 * exception is re-thrown after logging.
 *
 * @typeParam T - Return type of the wrapped function
 * @param logger - Admin logger instance (typically already scoped via withOperation/withActor)
 * @param operation - Name of the operation for log entries
 * @param fn - Async function to execute and trace
 * @returns The result of `fn`
 * @throws Re-throws any error raised by `fn`
 *
 * @example
 * ```ts
 * const result = await withAdminTracing(logger, 'tier.update', async () => {
 *     return await tierService.update(tierId, payload);
 * });
 * ```
 */
export async function withAdminTracing<T>(
    logger: AdminLogger,
    operation: string,
    fn: () => Promise<T>,
): Promise<T> {
    const opLogger = logger.withOperation(operation);
    const timer = startTimer();

    opLogger.info(`Starting operation: ${operation}`);

    try {
        const result = await fn();
        opLogger.info(`Completed operation: ${operation}`, {
            status: 'success',
            durationMs: timer.elapsed(),
        });
        return result;
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        opLogger.error(`Failed operation: ${operation}`, {
            status: 'error',
            durationMs: timer.elapsed(),
            error: errorMessage,
        });
        throw err;
    }
}

// ============================================================================
// Log Sanitization
// ============================================================================

/**
 * Deep-clones an object and redacts values at sensitive keys.
 *
 * Keys matching `password`, `secret`, `token`, `key`, or `authorization`
 * (case-insensitive) have their values replaced with `'[REDACTED]'`.
 * Intended for sanitizing request bodies and audit payloads before logging.
 *
 * @param obj - The value to sanitize (objects, arrays, and primitives are all supported)
 * @returns A deep copy with sensitive values redacted
 *
 * @example
 * ```ts
 * const safe = sanitizeForLog({ user: 'alice', token: 'sk_live_abc123' });
 * // => { user: 'alice', token: '[REDACTED]' }
 * ```
 */
export function sanitizeForLog(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map((item) => sanitizeForLog(item));
    }

    const record = obj as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const key of Object.keys(record)) {
        if (SENSITIVE_KEY_PATTERN.test(key)) {
            sanitized[key] = '[REDACTED]';
        } else {
            sanitized[key] = sanitizeForLog(record[key]);
        }
    }

    return sanitized;
}
