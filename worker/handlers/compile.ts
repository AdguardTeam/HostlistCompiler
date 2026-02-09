/**
 * Compile handlers for the Cloudflare Worker.
 * Provides compilation endpoints for filter lists.
 */

import { WORKER_DEFAULTS } from '../../src/config/defaults.ts';
import { createTracingContext, type ICompilerEvents, WorkerCompiler } from '../../src/index.ts';
import { AnalyticsService } from '../../src/services/AnalyticsService.ts';
import { generateRequestId, JsonResponse } from '../utils/index.ts';
import { recordMetric } from './metrics.ts';
import { compress, decompress, emitDiagnosticsToTailWorker, getCacheKey, QUEUE_BINDINGS_NOT_AVAILABLE_ERROR, updateQueueStats } from './queue.ts';
import type { BatchRequest, CompilationResult, CompileQueueMessage, CompileRequest, Env, PreviousVersion, Priority } from '../types.ts';

// ============================================================================
// Configuration
// ============================================================================

const CACHE_TTL = WORKER_DEFAULTS.CACHE_TTL_SECONDS;

/**
 * In-memory map for request deduplication.
 * Maps cache keys to pending compilation promises.
 */
const pendingCompilations = new Map<string, Promise<CompilationResult>>();

// ============================================================================
// Streaming Logger
// ============================================================================

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

// ============================================================================
// JSON Compilation Handler
// ============================================================================

/**
 * Handle compile requests with JSON response.
 */
export async function handleCompileJson(
    request: Request,
    env: Env,
    analytics?: AnalyticsService,
    requestId?: string,
): Promise<Response> {
    const startTime = Date.now();
    const body = await request.json() as CompileRequest;
    const { configuration, preFetchedContent, benchmark } = body;
    const configName = configuration.name || 'unnamed';
    const sourceCount = configuration.sources?.length || 0;

    // Track compilation request
    analytics?.trackCompilationRequest({
        requestId,
        configName,
        sourceCount,
    });

    // Check cache if no pre-fetched content
    const cacheKey = (!preFetchedContent || Object.keys(preFetchedContent).length === 0) ? await getCacheKey(configuration) : null;

    let previousCachedVersion: PreviousVersion | undefined;

    if (cacheKey) {
        // Check for in-flight request deduplication
        const pending = pendingCompilations.get(cacheKey);
        if (pending) {
            const result = await pending;
            analytics?.trackCacheHit({
                requestId,
                configName,
                cacheKey,
                ruleCount: result.ruleCount,
                durationMs: Date.now() - startTime,
            });
            return JsonResponse.success({
                ...result,
                deduplicated: true,
            }, {
                headers: { 'X-Request-Deduplication': 'HIT' },
            });
        }

        // Check KV cache
        const cached = await env.COMPILATION_CACHE.get(cacheKey, 'arrayBuffer');
        if (cached) {
            try {
                const decompressed = await decompress(cached);
                const result = JSON.parse(decompressed) as CompilationResult;

                previousCachedVersion = {
                    rules: result.rules || [],
                    ruleCount: result.ruleCount || 0,
                    compiledAt: result.compiledAt || new Date().toISOString(),
                };

                analytics?.trackCacheHit({
                    requestId,
                    configName,
                    cacheKey,
                    ruleCount: result.ruleCount,
                    outputSizeBytes: cached.byteLength,
                    durationMs: Date.now() - startTime,
                });

                return JsonResponse.success({
                    ...result,
                    cached: true,
                }, {
                    headers: { 'X-Cache': 'HIT' },
                });
            } catch (error) {
                // deno-lint-ignore no-console
                console.error('Cache decompression failed:', error);
            }
        }

        analytics?.trackCacheMiss({
            requestId,
            configName,
            cacheKey,
        });
    }

    // Create compilation promise for deduplication
    const compilationPromise = (async (): Promise<CompilationResult> => {
        try {
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

            // Cache the result
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
    const duration = Date.now() - startTime;

    if (!result.success) {
        await recordMetric(env, '/compile', duration, false, result.error);
        analytics?.trackCompilationError({
            requestId,
            configName,
            sourceCount,
            durationMs: duration,
            error: result.error,
            cacheKey: cacheKey || undefined,
        });

        return JsonResponse.serverError(result.error || 'Compilation failed');
    }

    await recordMetric(env, '/compile', duration, true);

    const outputSize = result.rules ? JSON.stringify(result.rules).length : 0;
    analytics?.trackCompilationSuccess({
        requestId,
        configName,
        sourceCount,
        ruleCount: result.ruleCount,
        durationMs: duration,
        outputSizeBytes: outputSize,
        cacheKey: cacheKey || undefined,
    });

    return JsonResponse.success(result, {
        headers: { 'X-Cache': 'MISS' },
    });
}

// ============================================================================
// Streaming Compilation Handler
// ============================================================================

/**
 * Handle compile requests with streaming response (SSE).
 */
export async function handleCompileStream(
    request: Request,
    env: Env,
): Promise<Response> {
    const startTime = Date.now();
    const body = await request.json() as CompileRequest;
    const { configuration, preFetchedContent, benchmark } = body;

    const cacheKey = (!preFetchedContent || Object.keys(preFetchedContent).length === 0) ? await getCacheKey(configuration) : null;

    let previousCachedVersion: PreviousVersion | undefined;

    if (cacheKey) {
        const cached = await env.COMPILATION_CACHE.get(cacheKey, 'arrayBuffer');
        if (cached) {
            try {
                const decompressed = await decompress(cached);
                const result = JSON.parse(decompressed) as CompilationResult;
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

    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Start compilation in the background
    (async () => {
        try {
            const { sendEvent, logger } = createStreamingLogger(writer);
            const events = createStreamingEvents(sendEvent);

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

            if (result.diagnostics && result.diagnostics.length > 0) {
                for (const diagEvent of result.diagnostics) {
                    switch (diagEvent.category) {
                        case 'cache':
                            sendEvent('cache', diagEvent);
                            break;
                        case 'network':
                            sendEvent('network', diagEvent);
                            break;
                        case 'performance':
                            sendEvent('metric', diagEvent);
                            break;
                        default:
                            sendEvent('diagnostic', diagEvent);
                    }
                }
                emitDiagnosticsToTailWorker(result.diagnostics);
            }

            sendEvent('result', {
                rules: result.rules,
                ruleCount: result.rules.length,
                metrics: result.metrics,
                previousVersion: previousCachedVersion,
            });

            await writer.write(encoder.encode('event: done\ndata: {}\n\n'));

            // Cache the result
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

            await recordMetric(env, '/compile/stream', Date.now() - startTime, true);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await writer.write(
                encoder.encode(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`),
            );
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

// ============================================================================
// Batch Compilation Handler
// ============================================================================

/**
 * Handle batch compile requests.
 */
export async function handleCompileBatch(
    request: Request,
    env: Env,
): Promise<Response> {
    const startTime = Date.now();

    try {
        const body = await request.json() as BatchRequest;
        const { requests } = body;

        if (!requests || !Array.isArray(requests)) {
            return JsonResponse.badRequest('Invalid batch request format. Expected { requests: [...] }');
        }

        if (requests.length === 0) {
            return JsonResponse.badRequest('Batch request must contain at least one request');
        }

        if (requests.length > 10) {
            return JsonResponse.badRequest('Batch request limited to 10 requests maximum');
        }

        // Validate all requests have IDs
        const ids = new Set<string>();
        for (const req of requests) {
            if (!req.id) {
                return JsonResponse.badRequest('Each request must have an "id" field');
            }
            if (ids.has(req.id)) {
                return JsonResponse.badRequest(`Duplicate request ID: ${req.id}`);
            }
            ids.add(req.id);
        }

        // Process all requests in parallel
        const results = await Promise.all(
            requests.map(async (req) => {
                try {
                    const { configuration, preFetchedContent, benchmark } = req;

                    const cacheKey = (!preFetchedContent || Object.keys(preFetchedContent).length === 0) ? await getCacheKey(configuration) : null;

                    if (cacheKey) {
                        const pending = pendingCompilations.get(cacheKey);
                        if (pending) {
                            const result = await pending;
                            return { id: req.id, ...result, deduplicated: true };
                        }

                        const cached = await env.COMPILATION_CACHE.get(cacheKey, 'arrayBuffer');
                        if (cached) {
                            try {
                                const decompressed = await decompress(cached);
                                const result = JSON.parse(decompressed) as CompilationResult;
                                return { id: req.id, ...result, cached: true };
                            } catch (error) {
                                // deno-lint-ignore no-console
                                console.error('Cache decompression failed:', error);
                            }
                        }
                    }

                    const compilationPromise = (async (): Promise<CompilationResult> => {
                        try {
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

        await recordMetric(env, '/compile/batch', Date.now() - startTime, true);

        return JsonResponse.success({ results });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await recordMetric(env, '/compile/batch', Date.now() - startTime, false, message);
        return JsonResponse.serverError(message);
    }
}

// ============================================================================
// Async Compilation Handlers
// ============================================================================

/**
 * Handle async compile requests by sending to queue.
 */
export async function handleCompileAsync(
    request: Request,
    env: Env,
): Promise<Response> {
    const startTime = Date.now();

    try {
        const body = await request.json() as CompileRequest;
        const { configuration, preFetchedContent, benchmark, priority = 'standard' } = body;

        // deno-lint-ignore no-console
        console.log(`[API:ASYNC] Queueing compilation for "${configuration.name}" with ${priority} priority`);

        const requestId = await queueCompileJob(env, configuration, preFetchedContent, benchmark, priority);
        const duration = Date.now() - startTime;

        // deno-lint-ignore no-console
        console.log(`[API:ASYNC] Queued successfully in ${duration}ms (requestId: ${requestId})`);

        return JsonResponse.accepted({
            message: 'Compilation job queued successfully',
            note: 'The compilation will be processed asynchronously and cached when complete',
            requestId,
            priority,
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        const message = error instanceof Error ? error.message : String(error);

        // deno-lint-ignore no-console
        console.error(`[API:ASYNC] Failed to queue after ${duration}ms:`, message);

        return JsonResponse.serverError(message);
    }
}

/**
 * Handle async batch compile requests by sending to queue.
 */
export async function handleCompileBatchAsync(
    request: Request,
    env: Env,
): Promise<Response> {
    const startTime = Date.now();

    try {
        const body = await request.json() as BatchRequest;
        const { requests, priority = 'standard' } = body;

        if (!requests || !Array.isArray(requests)) {
            return JsonResponse.badRequest('Invalid batch request format. Expected { requests: [...] }');
        }

        if (requests.length === 0) {
            return JsonResponse.badRequest('Batch request must contain at least one request');
        }

        if (requests.length > 100) {
            return JsonResponse.badRequest('Batch request limited to 100 requests maximum');
        }

        // deno-lint-ignore no-console
        console.log(`[API:BATCH-ASYNC] Queueing batch of ${requests.length} compilations with ${priority} priority`);

        const requestId = await queueBatchCompileJob(env, requests, priority);
        const duration = Date.now() - startTime;

        // deno-lint-ignore no-console
        console.log(`[API:BATCH-ASYNC] Queued successfully in ${duration}ms (requestId: ${requestId})`);

        return JsonResponse.accepted({
            message: `Batch of ${requests.length} compilation jobs queued successfully`,
            note: 'The compilations will be processed asynchronously and cached when complete',
            requestId,
            batchSize: requests.length,
            priority,
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        const message = error instanceof Error ? error.message : String(error);

        // deno-lint-ignore no-console
        console.error(`[API:BATCH-ASYNC] Failed to queue after ${duration}ms:`, message);

        return JsonResponse.serverError(message);
    }
}

// ============================================================================
// Queue Job Helpers
// ============================================================================

/**
 * Send a compilation job to the queue.
 */
async function queueCompileJob(
    env: Env,
    configuration: CompileRequest['configuration'],
    preFetchedContent?: Record<string, string>,
    benchmark?: boolean,
    priority: Priority = 'standard',
): Promise<string> {
    if (!env.ADBLOCK_COMPILER_QUEUE || !env.ADBLOCK_COMPILER_QUEUE_HIGH_PRIORITY) {
        throw new Error(QUEUE_BINDINGS_NOT_AVAILABLE_ERROR);
    }

    const requestId = generateRequestId('compile');

    const message: CompileQueueMessage = {
        type: 'compile',
        requestId,
        timestamp: Date.now(),
        configuration,
        preFetchedContent,
        benchmark,
        priority,
    };

    const queue = priority === 'high' ? env.ADBLOCK_COMPILER_QUEUE_HIGH_PRIORITY : env.ADBLOCK_COMPILER_QUEUE;

    await queue.send(message);
    await updateQueueStats(env, 'enqueued');

    return requestId;
}

/**
 * Send a batch compilation job to the queue.
 */
async function queueBatchCompileJob(
    env: Env,
    requests: BatchRequest['requests'],
    priority: Priority = 'standard',
): Promise<string> {
    if (!env.ADBLOCK_COMPILER_QUEUE || !env.ADBLOCK_COMPILER_QUEUE_HIGH_PRIORITY) {
        throw new Error(QUEUE_BINDINGS_NOT_AVAILABLE_ERROR);
    }

    const requestId = generateRequestId('batch');

    const message = {
        type: 'batch-compile' as const,
        requestId,
        timestamp: Date.now(),
        requests,
        priority,
    };

    const queue = priority === 'high' ? env.ADBLOCK_COMPILER_QUEUE_HIGH_PRIORITY : env.ADBLOCK_COMPILER_QUEUE;

    await queue.send(message);
    await updateQueueStats(env, 'enqueued', undefined, requests.length);

    return requestId;
}

// ============================================================================
// AST Parser Handler
// ============================================================================

/**
 * Handle AST parsing requests.
 */
export async function handleASTParseRequest(
    request: Request,
    _env: Env,
): Promise<Response> {
    try {
        const body = await request.json() as { rules?: string[]; text?: string };

        const { ASTViewerService } = await import('../../src/services/ASTViewerService.ts');

        let parsedRules;

        if (body.rules && Array.isArray(body.rules)) {
            parsedRules = ASTViewerService.parseRules(body.rules);
        } else if (body.text && typeof body.text === 'string') {
            parsedRules = ASTViewerService.parseRulesFromText(body.text);
        } else {
            return JsonResponse.badRequest('Request must include either "rules" array or "text" string');
        }

        const summary = ASTViewerService.generateSummary(parsedRules);

        return JsonResponse.success({
            parsedRules,
            summary,
        });
    } catch (error) {
        return JsonResponse.serverError(error);
    }
}
