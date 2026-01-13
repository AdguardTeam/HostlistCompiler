/**
 * Cloudflare Worker for compiling hostlists.
 *
 * This worker demonstrates how to use the @jk-com/adblock-compiler
 * package in a Cloudflare Workers environment.
 *
 * Features:
 * - Compile filter lists from remote URLs
 * - Support for pre-fetched content
 * - Real-time progress events via Server-Sent Events
 * - JSON API for programmatic access
 */

/// <reference types="@cloudflare/workers-types" />

// NOTE: Container class for Cloudflare Containers deployment
// This is a stub for local development. When deploying with containers enabled,
// Cloudflare will use the Container runtime automatically.

// Stub class for local development (satisfies Durable Object binding requirement)
export class AdblockCompiler {
    defaultPort = 8787;

    constructor(_state: DurableObjectState, _env: Env) {
        // Stub constructor for local dev
    }

    async fetch(_request: Request): Promise<Response> {
        // Stub fetch for local dev - containers not used in local development
        return new Response('Container endpoints are only available in production deployment', {
            status: 501,
        });
    }
}

// When deploying with containers to production, the above stub will be replaced
// with the actual Container class by extending from cloudflare:workers Container

import {
    createTracingContext,
    type DiagnosticEvent,
    type ICompilerEvents,
    type IConfiguration,
    WorkerCompiler,
} from '../src/index.ts';

/**
 * Environment bindings for the worker.
 */
export interface Env {
    COMPILER_VERSION: string;
    // KV namespaces
    COMPILATION_CACHE: KVNamespace;
    RATE_LIMIT: KVNamespace;
    METRICS: KVNamespace;
    // Static assets
    ASSETS?: Fetcher;
    // Queue bindings (optional - queues must be created in Cloudflare dashboard first)
    ADBLOCK_COMPILER_QUEUE?: Queue<QueueMessage>;
    ADBLOCK_COMPILER_QUEUE_HIGH_PRIORITY?: Queue<QueueMessage>;
    // Turnstile configuration
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
}

/**
 * Priority levels for queue messages
 */
type Priority = 'standard' | 'high';

/**
 * Compile request body structure.
 */
interface CompileRequest {
    configuration: IConfiguration;
    preFetchedContent?: Record<string, string>;
    benchmark?: boolean;
    priority?: Priority;
    turnstileToken?: string;
}

/**
 * Queue message types for different operations
 */
type QueueMessageType = 'compile' | 'batch-compile' | 'cache-warm';

/**
 * Base queue message structure
 */
interface QueueMessage {
    type: QueueMessageType;
    requestId?: string;
    timestamp: number;
    priority?: Priority;
}

/**
 * Queue message for single compilation
 */
interface CompileQueueMessage extends QueueMessage {
    type: 'compile';
    configuration: IConfiguration;
    preFetchedContent?: Record<string, string>;
    benchmark?: boolean;
}

/**
 * Queue message for batch compilation
 */
interface BatchCompileQueueMessage extends QueueMessage {
    type: 'batch-compile';
    requests: Array<{
        id: string;
        configuration: IConfiguration;
        preFetchedContent?: Record<string, string>;
        benchmark?: boolean;
    }>;
}

/**
 * Queue message for cache warming
 */
interface CacheWarmQueueMessage extends QueueMessage {
    type: 'cache-warm';
    configurations: IConfiguration[];
}

/**
 * Rate limiting configuration
 */
const RATE_LIMIT_WINDOW = 60; // 60 seconds
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute

/**
 * Cache TTL in seconds
 */
const CACHE_TTL = 3600; // 1 hour

/**
 * Metrics aggregation window
 */
const METRICS_WINDOW = 300; // 5 minutes

/**
 * Error message for when queue bindings are not configured
 */
const QUEUE_BINDINGS_NOT_AVAILABLE_ERROR = 
    `Queue bindings are not available. \
To use async compilation, you must configure Cloudflare Queues in wrangler.toml. \
See https://github.com/jaypatrick/adblock-compiler/blob/master/docs/QUEUE_SUPPORT.md for setup instructions. \
Alternatively, use the synchronous endpoints: POST /compile or POST /compile/batch`;

/**
 * In-memory map for request deduplication
 * Maps cache keys to pending compilation promises
 */
const pendingCompilations = new Map<string, Promise<CompilationResult>>();

/**
 * Result of a compilation with metrics
 */
interface CompilationResult {
    success: boolean;
    rules?: string[];
    ruleCount?: number;
    metrics?: any;
    error?: string;
    compiledAt?: string;
    previousVersion?: {
        rules: string[];
        ruleCount: number;
        compiledAt: string;
    };
}

/**
 * Check rate limit for an IP address
 */
async function checkRateLimit(env: Env, ip: string): Promise<boolean> {
    const key = `ratelimit:${ip}`;
    const now = Date.now();

    // Get current count
    const data = await env.RATE_LIMIT.get(key, 'json') as { count: number; resetAt: number } | null;

    if (!data || now > data.resetAt) {
        // First request or window expired, start new window
        await env.RATE_LIMIT.put(
            key,
            JSON.stringify({ count: 1, resetAt: now + (RATE_LIMIT_WINDOW * 1000) }),
            { expirationTtl: RATE_LIMIT_WINDOW + 10 },
        );
        return true;
    }

    if (data.count >= RATE_LIMIT_MAX_REQUESTS) {
        return false; // Rate limit exceeded
    }

    // Increment count
    await env.RATE_LIMIT.put(
        key,
        JSON.stringify({ count: data.count + 1, resetAt: data.resetAt }),
        { expirationTtl: RATE_LIMIT_WINDOW + 10 },
    );

    return true;
}

/**
 * Turnstile verification response
 */
interface TurnstileVerifyResponse {
    success: boolean;
    challenge_ts?: string;
    hostname?: string;
    'error-codes'?: string[];
    action?: string;
    cdata?: string;
}

/**
 * Verify Cloudflare Turnstile token
 */
async function verifyTurnstileToken(
    env: Env,
    token: string,
    ip: string,
): Promise<{ success: boolean; error?: string }> {
    // If Turnstile is not configured, skip verification
    if (!env.TURNSTILE_SECRET_KEY) {
        return { success: true };
    }

    if (!token) {
        return { success: false, error: 'Missing Turnstile token' };
    }

    try {
        const formData = new FormData();
        formData.append('secret', env.TURNSTILE_SECRET_KEY);
        formData.append('response', token);
        formData.append('remoteip', ip);

        const response = await fetch(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            {
                method: 'POST',
                body: formData,
            },
        );

        const result = await response.json() as TurnstileVerifyResponse;

        if (result.success) {
            return { success: true };
        }

        const errorCodes = result['error-codes'] || [];
        return {
            success: false,
            error: `Turnstile verification failed: ${errorCodes.join(', ') || 'unknown error'}`,
        };
    } catch (error) {
        // deno-lint-ignore no-console
        console.error('Turnstile verification error:', error);
        return {
            success: false,
            error: 'Turnstile verification service unavailable',
        };
    }
}

/**
 * Generate cache key from configuration
 */
function getCacheKey(config: IConfiguration): string {
    // Create deterministic hash of configuration
    const normalized = JSON.stringify(config, Object.keys(config).sort());
    return `cache:${hashString(normalized)}`;
}

/**
 * Simple string hash function
 */
function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}

/**
 * Record request metrics
 */
async function recordMetric(
    env: Env,
    endpoint: string,
    duration: number,
    success: boolean,
    error?: string,
): Promise<void> {
    try {
        const now = Date.now();
        const windowKey = Math.floor(now / (METRICS_WINDOW * 1000));
        const metricKey = `metrics:${windowKey}:${endpoint}`;

        // Get existing metrics
        const existing = await env.METRICS.get(metricKey, 'json') as {
            count: number;
            success: number;
            failed: number;
            totalDuration: number;
            errors: Record<string, number>;
        } | null;

        const metrics = existing || {
            count: 0,
            success: 0,
            failed: 0,
            totalDuration: 0,
            errors: {},
        };

        // Update metrics
        metrics.count++;
        metrics.totalDuration += duration;

        if (success) {
            metrics.success++;
        } else {
            metrics.failed++;
            if (error) {
                metrics.errors[error] = (metrics.errors[error] || 0) + 1;
            }
        }

        // Store updated metrics
        await env.METRICS.put(
            metricKey,
            JSON.stringify(metrics),
            { expirationTtl: METRICS_WINDOW * 2 },
        );
    } catch (error) {
        // Don't fail requests if metrics fail
        // deno-lint-ignore no-console
        console.error('Failed to record metrics:', error);
    }
}

/**
 * Get aggregated metrics
 */
async function getMetrics(env: Env): Promise<any> {
    const now = Date.now();
    const currentWindow = Math.floor(now / (METRICS_WINDOW * 1000));

    const stats: Record<string, any> = {};

    // Get metrics from last 6 windows (30 minutes)
    for (let i = 0; i < 6; i++) {
        const windowKey = currentWindow - i;

        for (const endpoint of ['/compile', '/compile/stream', '/compile/batch']) {
            const metricKey = `metrics:${windowKey}:${endpoint}`;
            const data = await env.METRICS.get(metricKey, 'json') as any;

            if (data) {
                if (!stats[endpoint]) {
                    stats[endpoint] = {
                        count: 0,
                        success: 0,
                        failed: 0,
                        avgDuration: 0,
                        errors: {},
                    };
                }

                stats[endpoint].count += data.count;
                stats[endpoint].success += data.success;
                stats[endpoint].failed += data.failed;
                stats[endpoint].avgDuration =
                    (stats[endpoint].avgDuration * (stats[endpoint].count - data.count) +
                        (data.totalDuration / data.count) * data.count) / stats[endpoint].count;

                // Merge errors
                for (const [err, count] of Object.entries(data.errors)) {
                    stats[endpoint].errors[err] = (stats[endpoint].errors[err] || 0) +
                        (count as number);
                }
            }
        }
    }

    return {
        window: '30 minutes',
        timestamp: new Date().toISOString(),
        endpoints: stats,
    };
}

/**
 * Job history entry
 */
interface JobHistoryEntry {
    requestId: string;
    configName: string;
    status: 'completed' | 'failed' | 'cancelled';
    duration: number;
    timestamp: string;
    error?: string;
    ruleCount?: number;
    cacheKey?: string;
}

/**
 * Queue statistics structure with history
 */
interface QueueStats {
    pending: number;
    completed: number;
    failed: number;
    cancelled: number;
    totalProcessingTime: number;
    averageProcessingTime: number;
    processingRate: number; // jobs per minute
    queueLag: number; // average time in queue (ms)
    lastUpdate: string;
    history: JobHistoryEntry[];
    depthHistory: Array<{ timestamp: string; pending: number }>;
}

/**
 * Update queue statistics with job history and health metrics
 */
async function updateQueueStats(
    env: Env,
    type: 'enqueued' | 'completed' | 'failed' | 'cancelled',
    processingTime?: number,
    count: number = 1,
    jobInfo?: { requestId?: string; configName?: string; error?: string; ruleCount?: number; cacheKey?: string },
): Promise<void> {
    try {
        // Validate count parameter
        if (count <= 0 || !Number.isInteger(count)) {
            // deno-lint-ignore no-console
            console.warn(`Invalid count parameter: ${count}, defaulting to 1`);
            count = 1;
        }
        
        const key = 'queue:stats';
        const existing = await env.METRICS.get(key, 'json') as QueueStats | null;

        const stats: QueueStats = existing || {
            pending: 0,
            completed: 0,
            failed: 0,
            cancelled: 0,
            totalProcessingTime: 0,
            averageProcessingTime: 0,
            processingRate: 0,
            queueLag: 0,
            lastUpdate: new Date().toISOString(),
            history: [],
            depthHistory: [],
        };

        const now = new Date().toISOString();

        if (type === 'enqueued') {
            stats.pending += count;
            // Add to depth history (keep last 100 entries)
            stats.depthHistory.push({ timestamp: now, pending: stats.pending });
            if (stats.depthHistory.length > 100) {
                stats.depthHistory.shift();
            }
        } else if (type === 'completed') {
            stats.pending = Math.max(0, stats.pending - count);
            stats.completed += count;
            if (processingTime) {
                stats.totalProcessingTime += processingTime;
            }
            // Calculate average after updating completed count
            if (stats.completed > 0) {
                stats.averageProcessingTime = Math.round(
                    stats.totalProcessingTime / stats.completed,
                );
            }
            // Add to job history if jobInfo provided
            if (jobInfo?.requestId) {
                stats.history.unshift({
                    requestId: jobInfo.requestId,
                    configName: jobInfo.configName || 'Unknown',
                    status: 'completed',
                    duration: processingTime || 0,
                    timestamp: now,
                    ruleCount: jobInfo.ruleCount,
                    cacheKey: jobInfo.cacheKey,
                });
                // Keep only last 50 entries
                if (stats.history.length > 50) {
                    stats.history = stats.history.slice(0, 50);
                }
            }
        } else if (type === 'failed') {
            stats.pending = Math.max(0, stats.pending - count);
            stats.failed += count;
            // Add to job history if jobInfo provided
            if (jobInfo?.requestId) {
                stats.history.unshift({
                    requestId: jobInfo.requestId,
                    configName: jobInfo.configName || 'Unknown',
                    status: 'failed',
                    duration: processingTime || 0,
                    timestamp: now,
                    error: jobInfo.error,
                });
                // Keep only last 50 entries
                if (stats.history.length > 50) {
                    stats.history = stats.history.slice(0, 50);
                }
            }
        } else if (type === 'cancelled') {
            stats.pending = Math.max(0, stats.pending - count);
            stats.cancelled += count;
            // Add to job history if jobInfo provided
            if (jobInfo?.requestId) {
                stats.history.unshift({
                    requestId: jobInfo.requestId,
                    configName: jobInfo.configName || 'Unknown',
                    status: 'cancelled',
                    duration: 0,
                    timestamp: now,
                });
                // Keep only last 50 entries
                if (stats.history.length > 50) {
                    stats.history = stats.history.slice(0, 50);
                }
            }
        }

        // Calculate processing rate (jobs per minute) based on recent history
        const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
        const recentJobs = stats.history.filter(job => job.timestamp > oneMinuteAgo);
        stats.processingRate = recentJobs.length;

        // Calculate queue lag based on depth history
        if (stats.depthHistory.length > 1) {
            const avgDepth = stats.depthHistory.reduce((sum, entry) => sum + entry.pending, 0) / stats.depthHistory.length;
            // Estimate lag: if processing rate > 0, lag = avgDepth / (processingRate / 60)
            if (stats.processingRate > 0) {
                stats.queueLag = Math.round((avgDepth / (stats.processingRate / 60)) * 1000);
            }
        }

        stats.lastUpdate = now;

        await env.METRICS.put(key, JSON.stringify(stats), {
            expirationTtl: 86400, // 24 hours
        });
    } catch (error) {
        // deno-lint-ignore no-console
        console.error('Failed to update queue stats:', error);
    }
}

/**
 * Get queue statistics
 */
async function getQueueStats(env: Env): Promise<QueueStats> {
    try {
        const key = 'queue:stats';
        const stats = await env.METRICS.get(key, 'json') as QueueStats | null;

        return stats || {
            pending: 0,
            completed: 0,
            failed: 0,
            cancelled: 0,
            totalProcessingTime: 0,
            averageProcessingTime: 0,
            processingRate: 0,
            queueLag: 0,
            lastUpdate: new Date().toISOString(),
            history: [],
            depthHistory: [],
        };
    } catch (error) {
        // deno-lint-ignore no-console
        console.error('Failed to get queue stats:', error);
        return {
            pending: 0,
            completed: 0,
            failed: 0,
            cancelled: 0,
            totalProcessingTime: 0,
            averageProcessingTime: 0,
            processingRate: 0,
            queueLag: 0,
            lastUpdate: new Date().toISOString(),
            history: [],
            depthHistory: [],
        };
    }
}

/**
 * Compresses data using gzip
 */
async function compress(data: string): Promise<ArrayBuffer> {
    const stream = new Response(data).body!.pipeThrough(
        new CompressionStream('gzip'),
    );
    return new Response(stream).arrayBuffer();
}

/**
 * Decompresses gzipped data
 */
async function decompress(data: ArrayBuffer): Promise<string> {
    const stream = new Response(data).body!.pipeThrough(
        new DecompressionStream('gzip'),
    );
    return new Response(stream).text();
}

/**
 * Creates a logger that sends events through a TransformStream.
 */
function createStreamingLogger(writer: WritableStreamDefaultWriter<Uint8Array>) {
    const encoder = new TextEncoder();

    const sendEvent = (type: string, data: unknown) => {
        const event = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        writer.write(encoder.encode(event));
    };

    return {
        sendEvent,
        logger: {
            info: (message: string) => sendEvent('log', { level: 'info', message }),
            warn: (message: string) => sendEvent('log', { level: 'warn', message }),
            error: (message: string) => sendEvent('log', { level: 'error', message }),
            debug: (message: string) => sendEvent('log', { level: 'debug', message }),
            trace: (message: string) => sendEvent('log', { level: 'trace', message }),
        },
    };
}

/**
 * Creates compiler event handlers that stream progress via SSE.
 */
function createStreamingEvents(
    sendEvent: (type: string, data: unknown) => void,
): ICompilerEvents {
    return {
        onSourceStart: (event) => sendEvent('source:start', event),
        onSourceComplete: (event) => sendEvent('source:complete', event),
        onSourceError: (event) =>
            sendEvent('source:error', {
                ...event,
                error: event.error.message,
            }),
        onTransformationStart: (event) => sendEvent('transformation:start', event),
        onTransformationComplete: (event) => sendEvent('transformation:complete', event),
        onProgress: (event) => sendEvent('progress', event),
        onCompilationComplete: (event) => sendEvent('compilation:complete', event),
    };
}

/**
 * Emit diagnostic events to tail worker through console logging.
 * Console usage in this function is intentional for Cloudflare Workers tail integration.
 * Each diagnostic event is logged with a specific prefix for easy filtering.
 */
function emitDiagnosticsToTailWorker(diagnostics: DiagnosticEvent[]): void {
    // Emit a summary of diagnostic events
    // deno-lint-ignore no-console
    console.log(
        '[DIAGNOSTICS]',
        JSON.stringify({
            eventCount: diagnostics.length,
            timestamp: new Date().toISOString(),
        }),
    );

    // Emit each diagnostic event individually for granular tail worker processing
    for (const event of diagnostics) {
        // Use different console methods based on severity
        const logData = {
            ...event,
            source: 'adblock-compiler',
        };

        switch (event.severity) {
            case 'error':
                // deno-lint-ignore no-console
                console.error('[DIAGNOSTIC]', JSON.stringify(logData));
                break;
            case 'warn':
                // deno-lint-ignore no-console
                console.warn('[DIAGNOSTIC]', JSON.stringify(logData));
                break;
            case 'info':
                // deno-lint-ignore no-console
                console.info('[DIAGNOSTIC]', JSON.stringify(logData));
                break;
            default:
                // deno-lint-ignore no-console
                console.debug('[DIAGNOSTIC]', JSON.stringify(logData));
        }
    }
}

/**
 * Handle compile requests with streaming response.
 */
async function handleCompileStream(
    request: Request,
    env: Env,
): Promise<Response> {
    const startTime = Date.now();
    const body = await request.json() as CompileRequest;
    const { configuration, preFetchedContent, benchmark } = body;

    // Check cache for previous version (for diff comparison)
    const cacheKey = (!preFetchedContent || Object.keys(preFetchedContent).length === 0)
        ? getCacheKey(configuration)
        : null;

    let previousCachedVersion:
        | { rules: string[]; ruleCount: number; compiledAt: string }
        | undefined;

    if (cacheKey) {
        const cached = await env.COMPILATION_CACHE.get(cacheKey, 'arrayBuffer');
        if (cached) {
            try {
                const decompressed = await decompress(cached);
                const result = JSON.parse(decompressed);

                // Store previous version for diff comparison
                previousCachedVersion = {
                    rules: result.rules || [],
                    ruleCount: result.ruleCount || 0,
                    compiledAt: result.compiledAt || new Date().toISOString(),
                };
            } catch (error) {
                // deno-lint-ignore no-console
                console.error('Cache decompression failed:', error);
            }
        }
    }

    // Create a TransformStream for streaming the response
    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Start compilation in the background
    (async () => {
        try {
            const { sendEvent, logger } = createStreamingLogger(writer);
            const events = createStreamingEvents(sendEvent);

            // Create tracing context for diagnostics
            const tracingContext = createTracingContext({
                metadata: {
                    endpoint: '/compile/stream',
                    configName: configuration.name,
                },
            });

            const compiler = new WorkerCompiler({
                logger,
                events,
                preFetchedContent,
                tracingContext,
            });

            const result = await compiler.compileWithMetrics(configuration, benchmark ?? false);

            // Emit diagnostics to tail worker
            if (result.diagnostics) {
                emitDiagnosticsToTailWorker(result.diagnostics);
            }

            // Send final result with previous version for diff
            sendEvent('result', {
                rules: result.rules,
                ruleCount: result.rules.length,
                metrics: result.metrics,
                previousVersion: previousCachedVersion,
            });

            await writer.write(encoder.encode('event: done\ndata: {}\n\n'));

            // Cache the new result if no pre-fetched content
            if (cacheKey) {
                try {
                    const compilationResult: CompilationResult = {
                        success: true,
                        rules: result.rules,
                        ruleCount: result.rules.length,
                        metrics: result.metrics,
                        compiledAt: new Date().toISOString(),
                    };
                    const compressed = await compress(JSON.stringify(compilationResult));
                    await env.COMPILATION_CACHE.put(
                        cacheKey,
                        compressed,
                        { expirationTtl: CACHE_TTL },
                    );
                } catch (error) {
                    // deno-lint-ignore no-console
                    console.error('Cache compression failed:', error);
                }
            }

            // Record success metrics
            await recordMetric(env, '/compile/stream', Date.now() - startTime, true);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await writer.write(
                encoder.encode(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`),
            );

            // Record error metrics
            await recordMetric(env, '/compile/stream', Date.now() - startTime, false, message);
        } finally {
            await writer.close();
        }
    })();

    return new Response(readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        },
    });
}

/**
 * Handle compile requests with JSON response.
 */
async function handleCompileJson(
    request: Request,
    env: Env,
): Promise<Response> {
    const startTime = Date.now();
    const body = await request.json() as CompileRequest;
    const { configuration, preFetchedContent, benchmark } = body;

    // Check cache if no pre-fetched content (pre-fetched = dynamic, don't cache)
    const cacheKey = (!preFetchedContent || Object.keys(preFetchedContent).length === 0)
        ? getCacheKey(configuration)
        : null;

    // Declare previousCachedVersion at function scope
    let previousCachedVersion:
        | { rules: string[]; ruleCount: number; compiledAt: string }
        | undefined;

    if (cacheKey) {
        // Check for in-flight request deduplication
        const pending = pendingCompilations.get(cacheKey);
        if (pending) {
            const result = await pending;
            return Response.json({
                ...result,
                deduplicated: true,
            }, {
                headers: {
                    'X-Request-Deduplication': 'HIT',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Check KV cache and save for diff comparison
        const cached = await env.COMPILATION_CACHE.get(cacheKey, 'arrayBuffer');
        if (cached) {
            try {
                const decompressed = await decompress(cached);
                const result = JSON.parse(decompressed);

                // Store previous version for diff comparison
                previousCachedVersion = {
                    rules: result.rules || [],
                    ruleCount: result.ruleCount || 0,
                    compiledAt: result.compiledAt || new Date().toISOString(),
                };

                return Response.json({
                    ...result,
                    cached: true,
                }, {
                    headers: {
                        'X-Cache': 'HIT',
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            } catch (error) {
                // If decompression fails, continue with compilation
                // deno-lint-ignore no-console
                console.error('Cache decompression failed:', error);
            }
        }
    }

    // Create compilation promise for deduplication
    const compilationPromise = (async (): Promise<CompilationResult> => {
        try {
            // Create tracing context for diagnostics
            const tracingContext = createTracingContext({
                metadata: {
                    endpoint: '/compile',
                    configName: configuration.name,
                },
            });

            const compiler = new WorkerCompiler({
                preFetchedContent,
                tracingContext,
            });

            const result = await compiler.compileWithMetrics(configuration, benchmark ?? false);

            // Emit diagnostics to tail worker
            if (result.diagnostics) {
                emitDiagnosticsToTailWorker(result.diagnostics);
            }

            const response: CompilationResult = {
                success: true,
                rules: result.rules,
                ruleCount: result.rules.length,
                metrics: result.metrics,
                compiledAt: new Date().toISOString(),
                previousVersion: previousCachedVersion,
            };

            // Cache the result if no pre-fetched content (with compression)
            if (cacheKey) {
                try {
                    const compressed = await compress(JSON.stringify(response));
                    await env.COMPILATION_CACHE.put(
                        cacheKey,
                        compressed,
                        { expirationTtl: CACHE_TTL },
                    );
                } catch (error) {
                    // deno-lint-ignore no-console
                    console.error('Cache compression failed:', error);
                }
            }

            return response;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message };
        } finally {
            // Remove from pending compilations
            if (cacheKey) {
                pendingCompilations.delete(cacheKey);
            }
        }
    })();

    // Register pending compilation for deduplication
    if (cacheKey) {
        pendingCompilations.set(cacheKey, compilationPromise);
    }

    const result = await compilationPromise;
    const duration = Date.now() - startTime;

    if (!result.success) {
        // Record error metrics
        await recordMetric(env, '/compile', duration, false, result.error);

        return Response.json(result, {
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
        });
    }

    // Record success metrics
    await recordMetric(env, '/compile', duration, true);

    return Response.json(result, {
        headers: {
            'X-Cache': 'MISS',
            'Access-Control-Allow-Origin': '*',
        },
    });
}

/**
 * Handle batch compile requests.
 */
async function handleCompileBatch(
    request: Request,
    env: Env,
): Promise<Response> {
    const startTime = Date.now();

    interface BatchRequest {
        requests: Array<{
            id: string;
            configuration: IConfiguration;
            preFetchedContent?: Record<string, string>;
            benchmark?: boolean;
        }>;
    }

    try {
        const body = await request.json() as BatchRequest;
        const { requests } = body;

        if (!requests || !Array.isArray(requests)) {
            return Response.json(
                {
                    success: false,
                    error: 'Invalid batch request format. Expected { requests: [...] }',
                },
                { status: 400 },
            );
        }

        if (requests.length === 0) {
            return Response.json(
                { success: false, error: 'Batch request must contain at least one request' },
                { status: 400 },
            );
        }

        if (requests.length > 10) {
            return Response.json(
                { success: false, error: 'Batch request limited to 10 requests maximum' },
                { status: 400 },
            );
        }

        // Validate all requests have IDs
        const ids = new Set<string>();
        for (const req of requests) {
            if (!req.id) {
                return Response.json(
                    { success: false, error: 'Each request must have an "id" field' },
                    { status: 400 },
                );
            }
            if (ids.has(req.id)) {
                return Response.json(
                    { success: false, error: `Duplicate request ID: ${req.id}` },
                    { status: 400 },
                );
            }
            ids.add(req.id);
        }

        // Process all requests in parallel
        const results = await Promise.all(
            requests.map(async (req) => {
                try {
                    const { configuration, preFetchedContent, benchmark } = req;

                    // Check cache
                    const cacheKey =
                        (!preFetchedContent || Object.keys(preFetchedContent).length === 0)
                            ? getCacheKey(configuration)
                            : null;

                    if (cacheKey) {
                        // Check pending compilations
                        const pending = pendingCompilations.get(cacheKey);
                        if (pending) {
                            const result = await pending;
                            return { id: req.id, ...result, deduplicated: true };
                        }

                        // Check KV cache
                        const cached = await env.COMPILATION_CACHE.get(cacheKey, 'arrayBuffer');
                        if (cached) {
                            try {
                                const decompressed = await decompress(cached);
                                const result = JSON.parse(decompressed);
                                return { id: req.id, ...result, cached: true };
                            } catch (error) {
                                // deno-lint-ignore no-console
                                console.error('Cache decompression failed:', error);
                            }
                        }
                    }

                    // Compile
                    const compilationPromise = (async (): Promise<CompilationResult> => {
                        try {
                            // Create tracing context for diagnostics
                            const tracingContext = createTracingContext({
                                metadata: {
                                    endpoint: '/compile/batch',
                                    configName: configuration.name,
                                    batchId: req.id,
                                },
                            });

                            const compiler = new WorkerCompiler({
                                preFetchedContent,
                                tracingContext,
                            });
                            const result = await compiler.compileWithMetrics(
                                configuration,
                                benchmark ?? false,
                            );

                            // Emit diagnostics to tail worker
                            if (result.diagnostics) {
                                emitDiagnosticsToTailWorker(result.diagnostics);
                            }

                            const response: CompilationResult = {
                                success: true,
                                rules: result.rules,
                                ruleCount: result.rules.length,
                                metrics: result.metrics,
                                compiledAt: new Date().toISOString(),
                            };

                            // Cache with compression
                            if (cacheKey) {
                                try {
                                    const compressed = await compress(JSON.stringify(response));
                                    await env.COMPILATION_CACHE.put(
                                        cacheKey,
                                        compressed,
                                        { expirationTtl: CACHE_TTL },
                                    );
                                } catch (error) {
                                    // deno-lint-ignore no-console
                                    console.error('Cache compression failed:', error);
                                }
                            }

                            return response;
                        } catch (error) {
                            const message = error instanceof Error ? error.message : String(error);
                            return { success: false, error: message };
                        } finally {
                            if (cacheKey) {
                                pendingCompilations.delete(cacheKey);
                            }
                        }
                    })();

                    if (cacheKey) {
                        pendingCompilations.set(cacheKey, compilationPromise);
                    }

                    const result = await compilationPromise;
                    return { id: req.id, ...result };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return { id: req.id, success: false, error: message };
                }
            }),
        );

        // Record success metrics
        await recordMetric(env, '/compile/batch', Date.now() - startTime, true);

        return Response.json(
            { success: true, results },
            {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
            },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        // Record error metrics
        await recordMetric(env, '/compile/batch', Date.now() - startTime, false, message);

        return Response.json(
            { success: false, error: message },
            { status: 500 },
        );
    }
}

/**
 * Handle async compile requests by sending to queue
 */
async function handleCompileAsync(
    request: Request,
    env: Env,
): Promise<Response> {
    const startTime = Date.now();

    try {
        const body = await request.json() as CompileRequest;
        const { configuration, preFetchedContent, benchmark, priority = 'standard' } = body;

        // deno-lint-ignore no-console
        console.log(`[API:ASYNC] Queueing compilation for "${configuration.name}" with ${priority} priority`);

        // Send to queue with specified priority
        const requestId = await queueCompileJob(env, configuration, preFetchedContent, benchmark, priority);
        const duration = Date.now() - startTime;

        // deno-lint-ignore no-console
        console.log(`[API:ASYNC] Queued successfully in ${duration}ms (requestId: ${requestId})`);

        return Response.json(
            {
                success: true,
                message: 'Compilation job queued successfully',
                note: 'The compilation will be processed asynchronously and cached when complete',
                requestId,
                priority,
            },
            {
                status: 202, // Accepted
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
            },
        );
    } catch (error) {
        const duration = Date.now() - startTime;
        const message = error instanceof Error ? error.message : String(error);

        // deno-lint-ignore no-console
        console.error(`[API:ASYNC] Failed to queue after ${duration}ms:`, message);

        return Response.json(
            { success: false, error: message },
            {
                status: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
            },
        );
    }
}

/**
 * Handle async batch compile requests by sending to queue
 */
async function handleCompileBatchAsync(
    request: Request,
    env: Env,
): Promise<Response> {
    const startTime = Date.now();

    try {
        interface BatchRequest {
            requests: Array<{
                id: string;
                configuration: IConfiguration;
                preFetchedContent?: Record<string, string>;
                benchmark?: boolean;
            }>;
            priority?: Priority;
        }

        const body = await request.json() as BatchRequest;
        const { requests, priority = 'standard' } = body;

        if (!requests || !Array.isArray(requests)) {
            return Response.json(
                {
                    success: false,
                    error: 'Invalid batch request format. Expected { requests: [...] }',
                },
                { status: 400 },
            );
        }

        if (requests.length === 0) {
            return Response.json(
                { success: false, error: 'Batch request must contain at least one request' },
                { status: 400 },
            );
        }

        if (requests.length > 100) {
            return Response.json(
                { success: false, error: 'Batch request limited to 100 requests maximum' },
                { status: 400 },
            );
        }

        // deno-lint-ignore no-console
        console.log(`[API:BATCH-ASYNC] Queueing batch of ${requests.length} compilations with ${priority} priority`);

        // Send to queue with specified priority
        const requestId = await queueBatchCompileJob(env, requests, priority);
        const duration = Date.now() - startTime;

        // deno-lint-ignore no-console
        console.log(`[API:BATCH-ASYNC] Queued successfully in ${duration}ms (requestId: ${requestId})`);

        return Response.json(
            {
                success: true,
                message: `Batch of ${requests.length} compilation jobs queued successfully`,
                note: 'The compilations will be processed asynchronously and cached when complete',
                requestId,
                batchSize: requests.length,
                priority,
            },
            {
                status: 202, // Accepted
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
            },
        );
    } catch (error) {
        const duration = Date.now() - startTime;
        const message = error instanceof Error ? error.message : String(error);

        // deno-lint-ignore no-console
        console.error(`[API:BATCH-ASYNC] Failed to queue after ${duration}ms:`, message);

        return Response.json(
            { success: false, error: message },
            {
                status: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
            },
        );
    }
}

/**
 * Handle GET requests - return API info and example.
 */
function handleInfo(env: Env): Response {
    const info = {
        name: 'Hostlist Compiler Worker',
        version: env.COMPILER_VERSION,
        endpoints: {
            'GET /': 'Web UI for interactive compilation',
            'GET /api': 'API information (this endpoint)',
            'GET /metrics': 'Request metrics and statistics',
            'GET /queue/stats': 'Queue statistics and diagnostics',
            'GET /queue/history': 'Job history and queue depth over time',
            'POST /queue/cancel/:requestId': 'Cancel a pending queue job',
            'POST /compile': 'Compile a filter list (JSON response)',
            'POST /compile/stream': 'Compile with real-time progress (SSE)',
            'POST /compile/batch': 'Compile multiple filter lists in parallel',
            'POST /compile/async': 'Queue a compilation job for async processing',
            'POST /compile/batch/async': 'Queue multiple compilations for async processing',
        },
        example: {
            method: 'POST',
            url: '/compile',
            body: {
                configuration: {
                    name: 'My Filter List',
                    sources: [
                        {
                            name: 'Example Source',
                            source: 'https://example.com/filters.txt',
                        },
                    ],
                    transformations: ['Deduplicate', 'RemoveEmptyLines'],
                },
                benchmark: true,
            },
        },
    };

    return Response.json(info, {
        headers: {
            'Access-Control-Allow-Origin': '*',
        },
    });
}

/**
 * Handle CORS preflight requests.
 */
function handleCors(): Response {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
        },
    });
}

/**
 * Serve the web UI HTML from static assets.
 */
async function serveWebUI(env: Env): Promise<Response> {
    return serveStaticFile(env, 'index.html');
}

/**
 * Serve a static file from static assets.
 */
async function serveStaticFile(env: Env, filename: string): Promise<Response> {
    // Try to serve from ASSETS if available (modern approach)
    if (env.ASSETS) {
        try {
            const assetUrl = new URL(filename, 'http://assets');
            const response = await env.ASSETS.fetch(assetUrl);
            if (response.ok) {
                return response;
            }
        } catch (error) {
            // deno-lint-ignore no-console
            console.error(`Failed to load ${filename} from assets:`, error);
        }
    }

    // Fallback to simple HTML if static assets not available
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hostlist Compiler</title>
</head>
<body style="font-family: sans-serif; max-width: 800px; margin: 50px auto; padding: 20px;">
    <h1>🛡️ Hostlist Compiler API</h1>
    <p>The web UI is available for local development only.</p>
    <p>To use the web interface locally, run:</p>
    <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px;">npm run dev</pre>
    <p>Then visit: <code>http://localhost:8787</code></p>
    
    <h2>API Endpoints</h2>
    <ul>
        <li><strong>GET /api</strong> - API information</li>
        <li><strong>POST /compile</strong> - Compile filter list (JSON response)</li>
        <li><strong>POST /compile/stream</strong> - Compile with real-time progress (SSE)</li>
    </ul>
    
    <h2>Example Usage</h2>
    <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px;">curl -X POST https://adblock-compiler.jayson-knight.workers.dev/compile \\
  -H "Content-Type: application/json" \\
  -d '{
    "configuration": {
      "name": "My Filter List",
      "sources": [
        { "source": "https://example.com/filters.txt" }
      ],
      "transformations": ["Deduplicate", "RemoveEmptyLines"]
    }
  }'</pre>
  
    <p><a href="/api">View full API documentation →</a></p>
</body>
</html>`;

    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
        },
    });
}

/**
 * Generate a unique request ID with a prefix
 */
function generateRequestId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Process a single compile message from the queue
 */
async function processCompileMessage(
    message: CompileQueueMessage,
    env: Env,
): Promise<void> {
    const startTime = Date.now();
    const { configuration, preFetchedContent, benchmark } = message;

    // deno-lint-ignore no-console
    console.log(`[QUEUE:COMPILE] Starting compilation for "${configuration.name}" (requestId: ${message.requestId})`);

    try {
        // Create cache key
        const cacheKey = (!preFetchedContent || Object.keys(preFetchedContent).length === 0)
            ? getCacheKey(configuration)
            : null;

        // deno-lint-ignore no-console
        console.log(`[QUEUE:COMPILE] Cache key: ${cacheKey ? cacheKey.substring(0, 20) + '...' : 'none (pre-fetched content)'}`);

        // Create tracing context
        const tracingContext = createTracingContext({
            metadata: {
                endpoint: 'queue/compile',
                configName: configuration.name,
                requestId: message.requestId,
                timestamp: message.timestamp,
                ...(cacheKey ? { cacheKey } : {}),
            },
        });

        const compiler = new WorkerCompiler({
            preFetchedContent,
            tracingContext,
        });

        const compileStartTime = Date.now();
        const result = await compiler.compileWithMetrics(configuration, benchmark ?? false);
        const compileDuration = Date.now() - compileStartTime;

        // deno-lint-ignore no-console
        console.log(
            `[QUEUE:COMPILE] Compilation completed in ${compileDuration}ms, ${result.rules.length} rules generated`,
        );

        // Emit diagnostics to tail worker
        if (result.diagnostics) {
            // deno-lint-ignore no-console
            console.log(`[QUEUE:COMPILE] Emitting ${result.diagnostics.length} diagnostic events`);
            emitDiagnosticsToTailWorker(result.diagnostics);
        }

        // Cache the result if no pre-fetched content
        if (cacheKey) {
            try {
                const cacheStartTime = Date.now();
                const compilationResult: CompilationResult = {
                    success: true,
                    rules: result.rules,
                    ruleCount: result.rules.length,
                    metrics: result.metrics,
                    compiledAt: new Date().toISOString(),
                };
                const uncompressedSize = JSON.stringify(compilationResult).length;
                const compressed = await compress(JSON.stringify(compilationResult));
                const compressedSize = compressed.byteLength;
                const compressionRatio = ((1 - compressedSize / uncompressedSize) * 100).toFixed(1);

                await env.COMPILATION_CACHE.put(
                    cacheKey,
                    compressed,
                    { expirationTtl: CACHE_TTL },
                );
                const cacheDuration = Date.now() - cacheStartTime;

                // deno-lint-ignore no-console
                console.log(
                    `[QUEUE:COMPILE] Cached compilation in ${cacheDuration}ms ` +
                        `(${uncompressedSize} -> ${compressedSize} bytes, ${compressionRatio}% compression)`,
                );
            } catch (error) {
                // deno-lint-ignore no-console
                console.error('[QUEUE:COMPILE] Cache compression failed:', error);
            }
        }

        const totalDuration = Date.now() - startTime;
        // deno-lint-ignore no-console
        console.log(`[QUEUE:COMPILE] Total processing time: ${totalDuration}ms for "${configuration.name}"`);
        
        // Track successful completion with job info (include cacheKey for result retrieval)
        await updateQueueStats(env, 'completed', totalDuration, 1, {
            requestId: message.requestId,
            configName: configuration.name,
            ruleCount: result.rules.length,
            cacheKey: cacheKey || undefined,
        });
    } catch (error) {
        const totalDuration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // deno-lint-ignore no-console
        console.error(
            `[QUEUE:COMPILE] Processing failed after ${totalDuration}ms for "${configuration.name}":`,
            errorMessage,
        );
        
        // Track failure with job info
        await updateQueueStats(env, 'failed', totalDuration, 1, {
            requestId: message.requestId,
            configName: configuration.name,
            error: errorMessage,
        });
        
        throw error; // Re-throw to trigger retry
    }
}

/**
 * Process items in chunks with controlled concurrency
 */
async function processInChunks<T>(
    items: T[],
    chunkSize: number,
    processor: (item: T) => Promise<void>,
    getItemId?: (item: T) => string,
): Promise<{ successful: number; failed: number; failures: Array<{ item: string; error: string }> }> {
    let successful = 0;
    let failed = 0;
    const failures: Array<{ item: string; error: string }> = [];

    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const chunkNumber = Math.floor(i / chunkSize) + 1;
        const totalChunks = Math.ceil(items.length / chunkSize);

        // deno-lint-ignore no-console
        console.log(`[QUEUE:CHUNKS] Processing chunk ${chunkNumber}/${totalChunks} (${chunk.length} items)`);

        const results = await Promise.allSettled(chunk.map((item) => processor(item)));

        results.forEach((result, idx) => {
            const item = chunk[idx];
            const itemId = getItemId ? getItemId(item) : `item-${i + idx}`;

            if (result.status === 'fulfilled') {
                successful++;
            } else {
                failed++;
                const errorMessage = result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason);

                failures.push({
                    item: itemId,
                    error: errorMessage,
                });

                // deno-lint-ignore no-console
                console.error(`[QUEUE:CHUNKS] Item "${itemId}" failed:`, errorMessage);
            }
        });

        // deno-lint-ignore no-console
        console.log(
            `[QUEUE:CHUNKS] Chunk ${chunkNumber}/${totalChunks} completed (${successful}/${i + chunk.length} successful)`,
        );
    }

    return { successful, failed, failures };
}

/**
 * Process a batch compile message from the queue
 */
async function processBatchCompileMessage(
    message: BatchCompileQueueMessage,
    env: Env,
): Promise<void> {
    const startTime = Date.now();
    const batchSize = message.requests.length;

    // deno-lint-ignore no-console
    console.log(
        `[QUEUE:BATCH] Starting batch compilation of ${batchSize} requests (requestId: ${message.requestId})`,
    );

    try {
        // Process requests in chunks of 3 to avoid overwhelming resources
        const stats = await processInChunks(
            message.requests,
            3,
            async (req) => {
                const compileMessage: CompileQueueMessage = {
                    type: 'compile',
                    requestId: req.id,
                    timestamp: message.timestamp,
                    configuration: req.configuration,
                    preFetchedContent: req.preFetchedContent,
                    benchmark: req.benchmark,
                };
                await processCompileMessage(compileMessage, env);
            },
            (req) => req.configuration.name,
        );

        const duration = Date.now() - startTime;
        const avgDuration = Math.round(duration / batchSize);

        // deno-lint-ignore no-console
        console.log(
            `[QUEUE:BATCH] Batch complete: ${stats.successful}/${batchSize} successful, ` +
                `${stats.failed} failed in ${duration}ms (avg ${avgDuration}ms per item)`,
        );

        // If any failed, log details and throw to trigger retry
        if (stats.failed > 0) {
            // deno-lint-ignore no-console
            console.error(
                `[QUEUE:BATCH] Failed items:`,
                stats.failures.map((f) => `${f.item}: ${f.error}`).join('; '),
            );
            throw new Error(
                `Batch partially failed: ${stats.failed}/${batchSize} items failed. ` +
                    `Failures: ${stats.failures.map((f) => f.item).join(', ')}`,
            );
        }
    } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // deno-lint-ignore no-console
        console.error(`[QUEUE:BATCH] Batch processing failed after ${duration}ms:`, errorMessage);
        throw error; // Re-throw to trigger retry
    }
}

/**
 * Process a cache warming message from the queue
 */
async function processCacheWarmMessage(
    message: CacheWarmQueueMessage,
    env: Env,
): Promise<void> {
    const startTime = Date.now();
    const configCount = message.configurations.length;

    // deno-lint-ignore no-console
    console.log(
        `[QUEUE:CACHE-WARM] Starting cache warming for ${configCount} configurations (requestId: ${message.requestId})`,
    );

    try {
        // Process cache warming in chunks of 3 to avoid overwhelming resources
        const stats = await processInChunks(
            message.configurations,
            3,
            async (configuration) => {
                const compileMessage: CompileQueueMessage = {
                    type: 'compile',
                    requestId: generateRequestId('cache-warm'),
                    timestamp: message.timestamp,
                    configuration,
                    benchmark: false,
                };
                await processCompileMessage(compileMessage, env);
            },
            (config) => config.name,
        );

        const duration = Date.now() - startTime;
        const avgDuration = Math.round(duration / configCount);

        // deno-lint-ignore no-console
        console.log(
            `[QUEUE:CACHE-WARM] Cache warming complete: ${stats.successful}/${configCount} successful, ` +
                `${stats.failed} failed in ${duration}ms (avg ${avgDuration}ms per config)`,
        );

        // If any failed, log details and throw to trigger retry
        if (stats.failed > 0) {
            // deno-lint-ignore no-console
            console.error(
                `[QUEUE:CACHE-WARM] Failed configurations:`,
                stats.failures.map((f) => `${f.item}: ${f.error}`).join('; '),
            );
            throw new Error(
                `Cache warming partially failed: ${stats.failed}/${configCount} configs failed. ` +
                    `Failures: ${stats.failures.map((f) => f.item).join(', ')}`,
            );
        }
    } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // deno-lint-ignore no-console
        console.error(`[QUEUE:CACHE-WARM] Cache warming failed after ${duration}ms:`, errorMessage);
        throw error; // Re-throw to trigger retry
    }
}

/**
 * Queue consumer handler for processing compilation jobs
 */
async function handleQueue(
    batch: MessageBatch<QueueMessage>,
    env: Env,
): Promise<void> {
    const batchStartTime = Date.now();
    const batchSize = batch.messages.length;

    // deno-lint-ignore no-console
    console.log(`[QUEUE:HANDLER] Processing batch of ${batchSize} messages`);

    let processed = 0;
    let acked = 0;
    let retried = 0;
    let unknown = 0;

    // Process messages sequentially to avoid overwhelming resources
    for (const message of batch.messages) {
        const messageStartTime = Date.now();
        processed++;

        try {
            const msg = message.body;

            // deno-lint-ignore no-console
            console.log(
                `[QUEUE:HANDLER] Processing message ${processed}/${batchSize}, type: ${msg.type}, ` +
                    `requestId: ${msg.requestId || 'none'}`,
            );

            switch (msg.type) {
                case 'compile':
                    await processCompileMessage(msg as CompileQueueMessage, env);
                    message.ack();
                    acked++;
                    break;

                case 'batch-compile':
                    await processBatchCompileMessage(msg as BatchCompileQueueMessage, env);
                    message.ack();
                    acked++;
                    break;

                case 'cache-warm':
                    await processCacheWarmMessage(msg as CacheWarmQueueMessage, env);
                    message.ack();
                    acked++;
                    break;

                default:
                    // deno-lint-ignore no-console
                    console.warn(`[QUEUE:HANDLER] Unknown message type: ${(msg as any).type}`);
                    message.ack(); // Ack unknown types to prevent infinite retries
                    acked++;
                    unknown++;
            }

            const messageDuration = Date.now() - messageStartTime;
            // deno-lint-ignore no-console
            console.log(
                `[QUEUE:HANDLER] Message ${processed}/${batchSize} completed in ${messageDuration}ms and acknowledged`,
            );
        } catch (error) {
            const messageDuration = Date.now() - messageStartTime;
            const errorMessage = error instanceof Error ? error.message : String(error);

            // deno-lint-ignore no-console
            console.error(
                `[QUEUE:HANDLER] Message ${processed}/${batchSize} failed after ${messageDuration}ms, will retry: ${errorMessage}`,
            );
            // Retry on any error - message wasn't acknowledged
            message.retry();
            retried++;
        }
    }

    const batchDuration = Date.now() - batchStartTime;
    const avgDuration = Math.round(batchDuration / batchSize);

    // deno-lint-ignore no-console
    console.log(
        `[QUEUE:HANDLER] Batch complete: ${batchSize} messages processed in ${batchDuration}ms ` +
            `(avg ${avgDuration}ms per message). Acked: ${acked}, Retried: ${retried}, Unknown: ${unknown}`,
    );
}

/**
 * Send a compilation job to the queue
 */
async function queueCompileJob(
    env: Env,
    configuration: IConfiguration,
    preFetchedContent?: Record<string, string>,
    benchmark?: boolean,
    priority: Priority = 'standard',
): Promise<string> {
    // Check if queues are available
    if (!env.ADBLOCK_COMPILER_QUEUE || !env.ADBLOCK_COMPILER_QUEUE_HIGH_PRIORITY) {
        throw new Error(QUEUE_BINDINGS_NOT_AVAILABLE_ERROR);
    }

    const requestId = generateRequestId('compile');

    if (!requestId) {
        throw new Error('Failed to generate request ID');
    }

    const message: CompileQueueMessage = {
        type: 'compile',
        requestId,
        timestamp: Date.now(),
        configuration,
        preFetchedContent,
        benchmark,
        priority,
    };

    // Route to appropriate queue based on priority
    const queue = priority === 'high'
        ? env.ADBLOCK_COMPILER_QUEUE_HIGH_PRIORITY
        : env.ADBLOCK_COMPILER_QUEUE;

    await queue.send(message);

    // Track queue statistics
    await updateQueueStats(env, 'enqueued');

    return requestId;
}

/**
 * Send a batch compilation job to the queue
 */
async function queueBatchCompileJob(
    env: Env,
    requests: Array<{
        id: string;
        configuration: IConfiguration;
        preFetchedContent?: Record<string, string>;
        benchmark?: boolean;
    }>,
    priority: Priority = 'standard',
): Promise<string> {
    // Check if queues are available
    if (!env.ADBLOCK_COMPILER_QUEUE || !env.ADBLOCK_COMPILER_QUEUE_HIGH_PRIORITY) {
        throw new Error(QUEUE_BINDINGS_NOT_AVAILABLE_ERROR);
    }

    const requestId = generateRequestId('batch');

    if (!requestId) {
        throw new Error('Failed to generate request ID');
    }

    const message: BatchCompileQueueMessage = {
        type: 'batch-compile',
        requestId,
        timestamp: Date.now(),
        requests,
        priority,
    };

    // Route to appropriate queue based on priority
    const queue = priority === 'high'
        ? env.ADBLOCK_COMPILER_QUEUE_HIGH_PRIORITY
        : env.ADBLOCK_COMPILER_QUEUE;

    await queue.send(message);

    // Track queue statistics (batch update for efficiency)
    await updateQueueStats(env, 'enqueued', undefined, requests.length);

    return requestId;
}

/**
 * Main fetch handler for the Cloudflare Worker.
 */
export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const { pathname } = url;

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return handleCors();
        }

        // Handle API routes
        if (pathname === '/api' && request.method === 'GET') {
            return handleInfo(env);
        }

        // Handle Turnstile config endpoint (provides site key to frontend)
        if (pathname === '/api/turnstile-config' && request.method === 'GET') {
            return Response.json(
                {
                    siteKey: env.TURNSTILE_SITE_KEY || null,
                    enabled: !!env.TURNSTILE_SECRET_KEY,
                },
                {
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=3600',
                    },
                },
            );
        }

        // Handle metrics endpoint
        if (pathname === '/metrics' && request.method === 'GET') {
            const metrics = await getMetrics(env);
            return Response.json(metrics, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-cache',
                },
            });
        }

        // Handle queue stats endpoint
        if (pathname === '/queue/stats' && request.method === 'GET') {
            const stats = await getQueueStats(env);
            return Response.json(stats, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-cache',
                },
            });
        }

        // Handle queue history endpoint
        if (pathname === '/queue/history' && request.method === 'GET') {
            const stats = await getQueueStats(env);
            return Response.json({
                history: stats.history || [],
                depthHistory: stats.depthHistory || [],
            }, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-cache',
                },
            });
        }

        // Handle queue results endpoint - fetch cached results for a completed job
        if (pathname.startsWith('/queue/results/') && request.method === 'GET') {
            const requestId = pathname.split('/').pop();
            if (!requestId) {
                return Response.json({
                    success: false,
                    error: 'Invalid request ID'
                }, {
                    status: 400,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            }

            // Look up the job in history to get the cacheKey
            const stats = await getQueueStats(env);
            const job = stats.history.find(j => j.requestId === requestId);

            if (!job) {
                return Response.json({
                    success: false,
                    error: 'Job not found in history',
                    status: 'not_found'
                }, {
                    status: 404,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            }

            if (job.status !== 'completed') {
                return Response.json({
                    success: false,
                    error: `Job status is '${job.status}'`,
                    status: job.status,
                    jobInfo: {
                        configName: job.configName,
                        duration: job.duration,
                        timestamp: job.timestamp,
                        error: job.error,
                    }
                }, {
                    status: 200, // Still 200 so frontend can handle status
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            }

            if (!job.cacheKey) {
                return Response.json({
                    success: false,
                    error: 'No cache key available for this job (possibly used pre-fetched content)',
                    status: 'no_cache'
                }, {
                    status: 200,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            }

            // Fetch the cached result
            try {
                const cached = await env.COMPILATION_CACHE.get(job.cacheKey, 'arrayBuffer');
                if (!cached) {
                    return Response.json({
                        success: false,
                        error: 'Cached result has expired or was not found',
                        status: 'cache_miss'
                    }, {
                        status: 200,
                        headers: {
                            'Access-Control-Allow-Origin': '*',
                        },
                    });
                }

                const decompressed = await decompress(cached);
                const result = JSON.parse(decompressed);

                return Response.json({
                    success: true,
                    status: 'completed',
                    rules: result.rules || [],
                    ruleCount: result.ruleCount || result.rules?.length || 0,
                    metrics: result.metrics,
                    compiledAt: result.compiledAt,
                    jobInfo: {
                        configName: job.configName,
                        duration: job.duration,
                        timestamp: job.timestamp,
                    }
                }, {
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'no-cache',
                    },
                });
            } catch (error) {
                // deno-lint-ignore no-console
                console.error('Failed to decompress cached result:', error);
                return Response.json({
                    success: false,
                    error: 'Failed to decompress cached result',
                    status: 'decompress_error'
                }, {
                    status: 500,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            }
        }

        // Handle cancel job endpoint
        if (pathname.startsWith('/queue/cancel/') && request.method === 'POST') {
            const requestId = pathname.split('/').pop();
            if (requestId) {
                await updateQueueStats(env, 'cancelled', 0, 1, {
                    requestId,
                    configName: 'Cancelled by user',
                });
                return Response.json({
                    success: true,
                    message: `Job ${requestId} marked as cancelled`,
                    note: 'Job may still process if already started'
                }, {
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            }
            return Response.json({
                success: false,
                error: 'Invalid request ID'
            }, {
                status: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Rate limit and Turnstile verify compile endpoints
        if (
            (pathname === '/compile' || pathname === '/compile/stream' ||
                pathname === '/compile/batch') && request.method === 'POST'
        ) {
            const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
            const allowed = await checkRateLimit(env, ip);

            if (!allowed) {
                return Response.json(
                    {
                        success: false,
                        error: 'Rate limit exceeded. Maximum 10 requests per minute.',
                    },
                    {
                        status: 429,
                        headers: {
                            'Retry-After': '60',
                            'Access-Control-Allow-Origin': '*',
                        },
                    },
                );
            }

            // Verify Turnstile token if configured
            if (env.TURNSTILE_SECRET_KEY) {
                const clonedRequest = request.clone();
                try {
                    const body = await clonedRequest.json() as CompileRequest;
                    const turnstileResult = await verifyTurnstileToken(
                        env,
                        body.turnstileToken || '',
                        ip,
                    );
                    if (!turnstileResult.success) {
                        return Response.json(
                            {
                                success: false,
                                error: turnstileResult.error || 'Turnstile verification failed',
                            },
                            {
                                status: 403,
                                headers: {
                                    'Access-Control-Allow-Origin': '*',
                                },
                            },
                        );
                    }
                } catch (error) {
                    // deno-lint-ignore no-console
                    console.error('Error parsing request for Turnstile:', error);
                }
            }

            if (pathname === '/compile') {
                return handleCompileJson(request, env);
            }

            if (pathname === '/compile/stream') {
                return handleCompileStream(request, env);
            }

            if (pathname === '/compile/batch') {
                return handleCompileBatch(request, env);
            }
        }

        // Async compilation endpoints (Turnstile verified)
        if (pathname === '/compile/async' && request.method === 'POST') {
            // Verify Turnstile token if configured
            if (env.TURNSTILE_SECRET_KEY) {
                const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
                const clonedRequest = request.clone();
                try {
                    const body = await clonedRequest.json() as CompileRequest;
                    const turnstileResult = await verifyTurnstileToken(
                        env,
                        body.turnstileToken || '',
                        ip,
                    );
                    if (!turnstileResult.success) {
                        return Response.json(
                            {
                                success: false,
                                error: turnstileResult.error || 'Turnstile verification failed',
                            },
                            {
                                status: 403,
                                headers: {
                                    'Access-Control-Allow-Origin': '*',
                                },
                            },
                        );
                    }
                } catch (error) {
                    // deno-lint-ignore no-console
                    console.error('Error parsing request for Turnstile:', error);
                }
            }
            return handleCompileAsync(request, env);
        }

        if (pathname === '/compile/batch/async' && request.method === 'POST') {
            // Verify Turnstile token if configured
            if (env.TURNSTILE_SECRET_KEY) {
                const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
                const clonedRequest = request.clone();
                try {
                    const body = await clonedRequest.json() as CompileRequest;
                    const turnstileResult = await verifyTurnstileToken(
                        env,
                        body.turnstileToken || '',
                        ip,
                    );
                    if (!turnstileResult.success) {
                        return Response.json(
                            {
                                success: false,
                                error: turnstileResult.error || 'Turnstile verification failed',
                            },
                            {
                                status: 403,
                                headers: {
                                    'Access-Control-Allow-Origin': '*',
                                },
                            },
                        );
                    }
                } catch (error) {
                    // deno-lint-ignore no-console
                    console.error('Error parsing request for Turnstile:', error);
                }
            }
            return handleCompileBatchAsync(request, env);
        }

        // Serve web UI and static files
        if (request.method === 'GET') {
            // Try to serve from ASSETS
            if (env.ASSETS) {
                try {
                    const assetUrl = new URL(
                        pathname === '/' ? '/index.html' : pathname,
                        'http://assets',
                    );
                    let response = await env.ASSETS.fetch(assetUrl);

                    // Follow redirects for .html files (ASSETS automatically redirects .html to extensionless)
                    if (response.status === 307 || response.status === 308) {
                        const location = response.headers.get('Location');
                        if (location) {
                            const redirectUrl = new URL(location, assetUrl);
                            response = await env.ASSETS.fetch(redirectUrl);
                        }
                    }

                    if (response.ok) {
                        return response;
                    }
                } catch (error) {
                    // deno-lint-ignore no-console
                    console.error('Asset fetch error:', error);
                }
            }

            // Fallback for root path
            if (pathname === '/') {
                return serveWebUI(env);
            }
        }

        return new Response('Not Found', { status: 404 });
    },

    /**
     * Queue consumer handler for processing compilation jobs
     */
    async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
        await handleQueue(batch, env);
    },
};
