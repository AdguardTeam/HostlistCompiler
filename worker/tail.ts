/**
 * Cloudflare Tail Worker for logging and observability.
 *
 * This tail worker consumes logs and events from the main adblock-compiler worker,
 * providing real-time observability for debugging, monitoring, and alerting.
 *
 * Features:
 * - Captures console logs, exceptions, and errors
 * - Stores logs in KV for persistence and analysis
 * - Forwards critical errors to external endpoints (optional)
 * - Provides structured event processing
 *
 * @see https://developers.cloudflare.com/workers/observability/logs/tail-workers/
 */

/// <reference types="@cloudflare/workers-types" />

/**
 * Environment bindings for the tail worker.
 */
export interface TailEnv {
    // KV namespace for storing logs
    TAIL_LOGS?: KVNamespace;

    // Optional webhook URL for forwarding critical errors
    ERROR_WEBHOOK_URL?: string;

    // Optional log retention period in seconds (default: 24 hours)
    LOG_RETENTION_TTL?: string;
}

/**
 * Tail event structure from Cloudflare
 */
export interface TailEvent {
    scriptName?: string;
    outcome: 'ok' | 'exception' | 'exceededCpu' | 'exceededMemory' | 'unknown' | 'canceled';
    eventTimestamp: number;
    logs: TailLog[];
    exceptions: TailException[];
    event?: {
        request?: {
            url: string;
            method: string;
            headers: Record<string, string>;
        };
    };
}

export interface TailLog {
    timestamp: number;
    level: 'log' | 'debug' | 'info' | 'warn' | 'error';
    message: unknown[];
}

export interface TailException {
    timestamp: number;
    message: string;
    name: string;
}

/**
 * Format log messages for storage
 */
export function formatLogMessage(log: TailLog): string {
    const timestamp = new Date(log.timestamp).toISOString();
    const messages = log.message.map((m) => {
        try {
            return typeof m === 'object' ? JSON.stringify(m) : String(m);
        } catch (_error) {
            // Handle circular references or other JSON.stringify errors
            return String(m);
        }
    }).join(' ');
    return `[${timestamp}] [${log.level.toUpperCase()}] ${messages}`;
}

/**
 * Check if event should be forwarded to webhook
 */
export function shouldForwardEvent(event: TailEvent): boolean {
    // Forward exceptions and critical errors
    return event.outcome === 'exception' ||
        event.exceptions.length > 0 ||
        event.logs.some((log) => log.level === 'error');
}

/**
 * Create a structured event for external systems
 */
export function createStructuredEvent(event: TailEvent): Record<string, unknown> {
    return {
        timestamp: new Date(event.eventTimestamp).toISOString(),
        scriptName: event.scriptName || 'adblock-compiler',
        outcome: event.outcome,
        url: event.event?.request?.url,
        method: event.event?.request?.method,
        logs: event.logs.map((log) => ({
            timestamp: new Date(log.timestamp).toISOString(),
            level: log.level,
            message: log.message,
        })),
        exceptions: event.exceptions.map((exc) => ({
            timestamp: new Date(exc.timestamp).toISOString(),
            name: exc.name,
            message: exc.message,
        })),
    };
}

/**
 * Main tail handler
 */
export default {
    async tail(events: TailEvent[], env: TailEnv, ctx: ExecutionContext) {
        // Process each event
        const promises: Promise<void>[] = [];

        for (const event of events) {
            // Store logs in KV if available
            if (env.TAIL_LOGS) {
                const logKey = `log:${event.eventTimestamp}`;
                const logData = {
                    timestamp: new Date(event.eventTimestamp).toISOString(),
                    scriptName: event.scriptName,
                    outcome: event.outcome,
                    url: event.event?.request?.url,
                    method: event.event?.request?.method,
                    logs: event.logs.map(formatLogMessage),
                    exceptions: event.exceptions,
                };

                // Get retention TTL (default to 24 hours)
                // Validate that it's a valid number, fallback to default if invalid
                let ttl = 86400; // default: 24 hours
                if (env.LOG_RETENTION_TTL) {
                    const parsedTtl = parseInt(env.LOG_RETENTION_TTL);
                    if (!isNaN(parsedTtl) && parsedTtl > 0) {
                        ttl = parsedTtl;
                    }
                }

                promises.push(
                    env.TAIL_LOGS.put(
                        logKey,
                        JSON.stringify(logData),
                        { expirationTtl: ttl },
                    ),
                );
            }

            // Forward critical errors to webhook if configured
            if (env.ERROR_WEBHOOK_URL && shouldForwardEvent(event)) {
                const structuredEvent = createStructuredEvent(event);

                promises.push(
                    fetch(env.ERROR_WEBHOOK_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(structuredEvent),
                    })
                        .then((response) => {
                            if (!response.ok) {
                                console.error(
                                    `Failed to forward event to webhook: ${response.status} ${response.statusText}`,
                                );
                            }
                        })
                        .catch((error) => {
                            console.error('Error forwarding event to webhook:', error);
                        }),
                );
            }

            // Log summary to console for visibility
            if (event.outcome !== 'ok') {
                console.log(
                    `[TAIL] ${event.outcome} - ${event.event?.request?.method} ${event.event?.request?.url} - ` +
                        `${event.exceptions.length} exceptions, ${event.logs.length} logs`,
                );
            }

            // Log exceptions
            for (const exception of event.exceptions) {
                console.error(
                    `[TAIL] Exception: ${exception.name}: ${exception.message} at ${new Date(exception.timestamp).toISOString()}`,
                );
            }

            // Log error-level messages
            for (const log of event.logs) {
                if (log.level === 'error') {
                    console.error(`[TAIL] ${formatLogMessage(log)}`);
                }
            }
        }

        // Wait for all async operations to complete
        ctx.waitUntil(Promise.all(promises));
    },
};
