/**
 * Queue handling for the Cloudflare Worker.
 * Provides queue stats, job processing, and utility functions.
 */

import { WORKER_DEFAULTS } from '../../src/config/defaults.ts';
import { createTracingContext, type DiagnosticEvent, WorkerCompiler } from '../../src/index.ts';
import { JsonResponse, generateRequestId } from '../utils/index.ts';
import type {
    BatchCompileQueueMessage,
    CacheWarmQueueMessage,
    CompilationResult,
    CompileQueueMessage,
    Env,
    JobInfo,
    QueueMessage,
    QueueStats,
} from '../types.ts';

// ============================================================================
// Constants
// ============================================================================

const CACHE_TTL = WORKER_DEFAULTS.CACHE_TTL_SECONDS;

/**
 * Error message for when queue bindings are not configured
 */
export const QUEUE_BINDINGS_NOT_AVAILABLE_ERROR = 'Queue bindings are not available. ' +
    'To use async compilation, you must configure Cloudflare Queues in wrangler.toml. ' +
    'See https://github.com/jaypatrick/adblock-compiler/blob/main/docs/QUEUE_SUPPORT.md for setup instructions. ' +
    'Alternatively, use the synchronous endpoints: POST /compile or POST /compile/batch';

// ============================================================================
// Compression Utilities
// ============================================================================

/**
 * Compresses data using gzip
 */
export async function compress(data: string): Promise<ArrayBuffer> {
    const stream = new Response(data).body!.pipeThrough(
        new CompressionStream('gzip'),
    );
    return new Response(stream).arrayBuffer();
}

/**
 * Decompresses gzipped data
 */
export async function decompress(data: ArrayBuffer): Promise<string> {
    const stream = new Response(data).body!.pipeThrough(
        new DecompressionStream('gzip'),
    );
    return new Response(stream).text();
}

// ============================================================================
// Queue Statistics
// ============================================================================

/**
 * Create empty queue stats object
 */
function createEmptyQueueStats(): QueueStats {
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

/**
 * Update queue statistics with job history and health metrics.
 */
export async function updateQueueStats(
    env: Env,
    type: 'enqueued' | 'completed' | 'failed' | 'cancelled',
    processingTime?: number,
    count = 1,
    jobInfo?: JobInfo,
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
        const stats: QueueStats = existing || createEmptyQueueStats();
        const now = new Date().toISOString();

        switch (type) {
            case 'enqueued':
                stats.pending += count;
                // Add to depth history (keep last 100 entries)
                stats.depthHistory.push({ timestamp: now, pending: stats.pending });
                if (stats.depthHistory.length > 100) {
                    stats.depthHistory.shift();
                }
                break;

            case 'completed':
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
                    if (stats.history.length > 50) {
                        stats.history = stats.history.slice(0, 50);
                    }
                }
                break;

            case 'failed':
                stats.pending = Math.max(0, stats.pending - count);
                stats.failed += count;
                if (jobInfo?.requestId) {
                    stats.history.unshift({
                        requestId: jobInfo.requestId,
                        configName: jobInfo.configName || 'Unknown',
                        status: 'failed',
                        duration: processingTime || 0,
                        timestamp: now,
                        error: jobInfo.error,
                    });
                    if (stats.history.length > 50) {
                        stats.history = stats.history.slice(0, 50);
                    }
                }
                break;

            case 'cancelled':
                stats.pending = Math.max(0, stats.pending - count);
                stats.cancelled += count;
                if (jobInfo?.requestId) {
                    stats.history.unshift({
                        requestId: jobInfo.requestId,
                        configName: jobInfo.configName || 'Unknown',
                        status: 'cancelled',
                        duration: 0,
                        timestamp: now,
                    });
                    if (stats.history.length > 50) {
                        stats.history = stats.history.slice(0, 50);
                    }
                }
                break;
        }

        // Calculate processing rate (jobs per minute) based on recent history
        const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
        const recentJobs = stats.history.filter((job) => job.timestamp > oneMinuteAgo);
        stats.processingRate = recentJobs.length;

        // Calculate queue lag based on depth history
        if (stats.depthHistory.length > 1) {
            const avgDepth = stats.depthHistory.reduce((sum, entry) => sum + entry.pending, 0) /
                stats.depthHistory.length;
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
 * Get queue statistics.
 */
export async function getQueueStats(env: Env): Promise<QueueStats> {
    try {
        const key = 'queue:stats';
        const stats = await env.METRICS.get(key, 'json') as QueueStats | null;
        return stats || createEmptyQueueStats();
    } catch (error) {
        // deno-lint-ignore no-console
        console.error('Failed to get queue stats:', error);
        return createEmptyQueueStats();
    }
}

// ============================================================================
// Diagnostic Emitter
// ============================================================================

/**
 * Emit diagnostic events to tail worker through console logging.
 */
export function emitDiagnosticsToTailWorker(diagnostics: DiagnosticEvent[]): void {
    // deno-lint-ignore no-console
    console.log(
        '[DIAGNOSTICS]',
        JSON.stringify({
            eventCount: diagnostics.length,
            timestamp: new Date().toISOString(),
        }),
    );

    for (const event of diagnostics) {
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

// ============================================================================
// Message Processing
// ============================================================================

/**
 * Process a single compile message from the queue.
 */
export async function processCompileMessage(
    message: CompileQueueMessage,
    env: Env,
): Promise<void> {
    const startTime = Date.now();
    const { configuration, preFetchedContent, benchmark } = message;

    // deno-lint-ignore no-console
    console.log(`[QUEUE:COMPILE] Starting compilation for "${configuration.name}" (requestId: ${message.requestId})`);

    try {
        const cacheKey = (!preFetchedContent || Object.keys(preFetchedContent).length === 0)
            ? await getCacheKey(configuration)
            : null;

        // deno-lint-ignore no-console
        console.log(`[QUEUE:COMPILE] Cache key: ${cacheKey ? cacheKey.substring(0, 20) + '...' : 'none (pre-fetched content)'}`);

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

        await updateQueueStats(env, 'failed', totalDuration, 1, {
            requestId: message.requestId,
            configName: configuration.name,
            error: errorMessage,
        });

        throw error;
    }
}

/**
 * Process items in chunks with controlled concurrency.
 */
export async function processInChunks<T>(
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

                failures.push({ item: itemId, error: errorMessage });
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
 * Process a batch compile message from the queue.
 */
export async function processBatchCompileMessage(
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
        throw error;
    }
}

/**
 * Process a cache warming message from the queue.
 */
export async function processCacheWarmMessage(
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
        throw error;
    }
}

// ============================================================================
// Queue Consumer Handler
// ============================================================================

/**
 * Queue consumer handler for processing compilation jobs.
 */
export async function handleQueue(
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
                    console.warn(`[QUEUE:HANDLER] Unknown message type: ${(msg as QueueMessage).type}`);
                    message.ack();
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

// ============================================================================
// Cache Key Generation (with improved hashing)
// ============================================================================

/**
 * Generate cache key from configuration using SHA-256.
 * Uses Web Crypto API for deterministic, collision-resistant hashing.
 */
export async function getCacheKey(config: unknown): Promise<string> {
    const normalized = stableStringify(config);
    const hashBuffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(normalized),
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `cache:${hashHex.slice(0, 32)}`;
}

/**
 * Stable JSON stringify that handles nested objects deterministically.
 */
function stableStringify(obj: unknown): string {
    if (obj === null || obj === undefined) {
        return String(obj);
    }
    if (typeof obj !== 'object') {
        return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
        return '[' + obj.map(stableStringify).join(',') + ']';
    }
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const parts = keys.map((key) => {
        const value = (obj as Record<string, unknown>)[key];
        return JSON.stringify(key) + ':' + stableStringify(value);
    });
    return '{' + parts.join(',') + '}';
}

// ============================================================================
// HTTP Handlers
// ============================================================================

/**
 * Handle GET /queue/stats request.
 */
export async function handleQueueStats(env: Env): Promise<Response> {
    const stats = await getQueueStats(env);
    return JsonResponse.noCache(stats);
}

/**
 * Handle GET /queue/history request.
 */
export async function handleQueueHistory(env: Env): Promise<Response> {
    const stats = await getQueueStats(env);
    return JsonResponse.noCache({
        history: stats.history || [],
        depthHistory: stats.depthHistory || [],
    });
}

/**
 * Handle POST /queue/cancel/:requestId request.
 */
export async function handleQueueCancel(
    requestId: string,
    env: Env,
): Promise<Response> {
    if (!requestId) {
        return JsonResponse.badRequest('Invalid request ID');
    }

    await updateQueueStats(env, 'cancelled', 0, 1, {
        requestId,
        configName: 'Cancelled by user',
    });

    return JsonResponse.success({
        message: `Job ${requestId} marked as cancelled`,
        note: 'Job may still process if already started',
    });
}

/**
 * Handle GET /queue/results/:requestId request.
 */
export async function handleQueueResults(
    requestId: string,
    env: Env,
): Promise<Response> {
    if (!requestId) {
        return JsonResponse.badRequest('Invalid request ID');
    }

    const stats = await getQueueStats(env);
    const job = stats.history.find((j) => j.requestId === requestId);

    if (!job) {
        return JsonResponse.success({
            error: 'Job not found in history',
            status: 'not_found',
        });
    }

    if (job.status !== 'completed') {
        return JsonResponse.success({
            error: `Job status is '${job.status}'`,
            status: job.status,
            jobInfo: {
                configName: job.configName,
                duration: job.duration,
                timestamp: job.timestamp,
                error: job.error,
            },
        });
    }

    if (!job.cacheKey) {
        return JsonResponse.success({
            error: 'No cache key available for this job (possibly used pre-fetched content)',
            status: 'no_cache',
        });
    }

    try {
        const cached = await env.COMPILATION_CACHE.get(job.cacheKey, 'arrayBuffer');
        if (!cached) {
            return JsonResponse.success({
                error: 'Cached result has expired or was not found',
                status: 'cache_miss',
            });
        }

        const decompressed = await decompress(cached);
        const result = JSON.parse(decompressed) as CompilationResult;

        return JsonResponse.noCache({
            status: 'completed',
            rules: result.rules || [],
            ruleCount: result.ruleCount || result.rules?.length || 0,
            metrics: result.metrics,
            compiledAt: result.compiledAt,
            jobInfo: {
                configName: job.configName,
                duration: job.duration,
                timestamp: job.timestamp,
            },
        });
    } catch (error) {
        // deno-lint-ignore no-console
        console.error('Failed to decompress cached result:', error);
        return JsonResponse.serverError('Failed to decompress cached result');
    }
}
