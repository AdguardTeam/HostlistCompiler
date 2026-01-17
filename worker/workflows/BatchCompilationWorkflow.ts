/**
 * BatchCompilationWorkflow - Durable execution workflow for batch filter list compilation.
 *
 * This workflow handles multiple compilations in a single durable workflow,
 * providing crash recovery for long-running batch operations.
 *
 * Benefits:
 * - Individual compilation failures don't affect other items
 * - Automatic progress tracking across all items
 * - Crash recovery resumes from last completed item
 * - Built-in concurrency control
 */

/// <reference types="@cloudflare/workers-types" />

import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { createTracingContext, WorkerCompiler } from '../../src/index.ts';
import { AnalyticsService } from '../../src/services/AnalyticsService.ts';
import type { Env } from '../worker.ts';
import type { BatchCompilationParams, BatchWorkflowResult, WorkflowCompilationResult } from './types.ts';
import { WorkflowEvents } from './WorkflowEvents.ts';

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
 * Generate cache key from configuration
 */
function getCacheKey(config: { name: string; sources: unknown[]; transformations?: unknown[] }): string {
    const normalized = JSON.stringify(config, Object.keys(config).sort());
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `cache:${Math.abs(hash).toString(36)}`;
}

const CACHE_TTL = 86400;

/**
 * Maximum concurrent compilations within a batch
 */
const MAX_CONCURRENT = 3;

/**
 * BatchCompilationWorkflow handles multiple compilations with crash recovery.
 *
 * Steps:
 * 1. validate-batch - Validate all configurations
 * 2. compile-chunk-N - Process compilations in chunks
 * 3. aggregate-results - Combine results and update metrics
 */
export class BatchCompilationWorkflow extends WorkflowEntrypoint<Env, BatchCompilationParams> {
    /**
     * Main workflow execution
     */
    override async run(event: WorkflowEvent<BatchCompilationParams>, step: WorkflowStep): Promise<BatchWorkflowResult> {
        const startTime = Date.now();
        const { batchId, requests, priority } = event.payload;

        // Initialize event emitter for real-time progress tracking
        const events = new WorkflowEvents(this.env.METRICS, batchId, 'batch');

        // Initialize analytics service
        const analytics = new AnalyticsService(this.env.ANALYTICS_ENGINE);

        console.log(
            `[WORKFLOW:BATCH] Starting batch compilation workflow (batchId: ${batchId}, ` +
                `${requests.length} requests, priority: ${priority || 'standard'})`,
        );

        // Track batch workflow started
        analytics.trackWorkflowStarted({
            requestId: batchId,
            workflowId: batchId,
            workflowType: 'batch',
            itemCount: requests.length,
        });

        // Emit workflow started event
        await events.emitWorkflowStarted({
            totalRequests: requests.length,
            priority: priority || 'standard',
        });

        const results: WorkflowCompilationResult[] = [];
        let successful = 0;
        let failed = 0;

        try {
            // Step 1: Validate all configurations
            await events.emitStepStarted('validate-batch', { requestCount: requests.length });
            await step.do('validate-batch', {
                retries: { limit: 1, delay: '1 second' },
            }, async () => {
                console.log(`[WORKFLOW:BATCH] Step 1: Validating ${requests.length} configurations`);

                // Validate unique IDs
                const ids = new Set<string>();
                for (const req of requests) {
                    if (!req.id) {
                        throw new Error('Each request must have an ID');
                    }
                    if (ids.has(req.id)) {
                        throw new Error(`Duplicate request ID: ${req.id}`);
                    }
                    ids.add(req.id);

                    // Validate configuration
                    if (!req.configuration.name) {
                        throw new Error(`Request ${req.id}: Configuration must have a name`);
                    }
                    if (!req.configuration.sources || req.configuration.sources.length === 0) {
                        throw new Error(`Request ${req.id}: Configuration must have at least one source`);
                    }
                }

                return { valid: true, count: requests.length };
            });
            await events.emitStepCompleted('validate-batch', { count: requests.length });
            await events.emitProgress(10, 'Batch validated');

            // Step 2: Process in chunks for controlled concurrency
            const chunks: Array<typeof requests> = [];
            for (let i = 0; i < requests.length; i += MAX_CONCURRENT) {
                chunks.push(requests.slice(i, i + MAX_CONCURRENT));
            }

            console.log(`[WORKFLOW:BATCH] Processing ${requests.length} requests in ${chunks.length} chunks`);

            for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
                const chunk = chunks[chunkIndex];
                const chunkNumber = chunkIndex + 1;

                // Emit progress for chunk start
                const chunkProgress = 10 + Math.round((chunkIndex / chunks.length) * 70);
                await events.emitStepStarted(`compile-chunk-${chunkNumber}`, {
                    chunk: chunkNumber,
                    totalChunks: chunks.length,
                    items: chunk.length,
                });

                // Each chunk is a separate step for durability
                const chunkResults = await step.do(`compile-chunk-${chunkNumber}`, {
                    retries: { limit: 2, delay: '5 seconds', backoff: 'exponential' },
                    timeout: '10 minutes',
                }, async () => {
                    console.log(
                        `[WORKFLOW:BATCH] Processing chunk ${chunkNumber}/${chunks.length} ` +
                            `(${chunk.length} items)`,
                    );

                    const chunkCompilations = await Promise.allSettled(
                        chunk.map(async (req) => {
                            const compileStart = Date.now();
                            try {
                                // Create tracing context
                                const tracingContext = createTracingContext({
                                    metadata: {
                                        endpoint: 'workflow/batch',
                                        configName: req.configuration.name,
                                        requestId: req.id,
                                        batchId,
                                        chunkNumber,
                                    },
                                });

                                const compiler = new WorkerCompiler({
                                    preFetchedContent: req.preFetchedContent,
                                    tracingContext,
                                });

                                const result = await compiler.compileWithMetrics(
                                    req.configuration,
                                    req.benchmark ?? false,
                                );

                                // Cache the result
                                const shouldCache = !req.preFetchedContent ||
                                    Object.keys(req.preFetchedContent).length === 0;
                                const cacheKey = shouldCache ? getCacheKey(req.configuration) : undefined;

                                if (cacheKey) {
                                    const cacheData = {
                                        success: true,
                                        rules: result.rules,
                                        ruleCount: result.rules.length,
                                        metrics: result.metrics,
                                        compiledAt: new Date().toISOString(),
                                    };
                                    const compressed = await compress(JSON.stringify(cacheData));
                                    await this.env.COMPILATION_CACHE.put(
                                        cacheKey,
                                        compressed,
                                        { expirationTtl: CACHE_TTL },
                                    );
                                }

                                const compileResult: WorkflowCompilationResult = {
                                    success: true,
                                    requestId: req.id,
                                    configName: req.configuration.name,
                                    rules: result.rules,
                                    ruleCount: result.rules.length,
                                    cacheKey,
                                    compiledAt: new Date().toISOString(),
                                    totalDurationMs: Date.now() - compileStart,
                                    steps: {},
                                };

                                return compileResult;
                            } catch (error) {
                                const errorMessage = error instanceof Error ? error.message : String(error);
                                console.error(
                                    `[WORKFLOW:BATCH] Compilation failed for "${req.configuration.name}":`,
                                    errorMessage,
                                );

                                const failedResult: WorkflowCompilationResult = {
                                    success: false,
                                    requestId: req.id,
                                    configName: req.configuration.name,
                                    compiledAt: new Date().toISOString(),
                                    totalDurationMs: Date.now() - compileStart,
                                    steps: {},
                                    error: errorMessage,
                                };

                                return failedResult;
                            }
                        }),
                    );

                    // Process results
                    const processedResults: WorkflowCompilationResult[] = [];
                    for (const settledResult of chunkCompilations) {
                        if (settledResult.status === 'fulfilled') {
                            processedResults.push(settledResult.value);
                        } else {
                            // This shouldn't happen since we catch errors above, but handle it
                            processedResults.push({
                                success: false,
                                requestId: 'unknown',
                                configName: 'unknown',
                                compiledAt: new Date().toISOString(),
                                totalDurationMs: 0,
                                steps: {},
                                error: settledResult.reason?.message || 'Unknown error',
                            });
                        }
                    }

                    return processedResults;
                });

                // Aggregate chunk results
                for (const r of chunkResults) {
                    results.push(r);
                    if (r.success) {
                        successful++;
                    } else {
                        failed++;
                    }
                }

                await events.emitStepCompleted(`compile-chunk-${chunkNumber}`, {
                    successCount: chunkResults.filter((r) => r.success).length,
                    failCount: chunkResults.filter((r) => !r.success).length,
                });
                await events.emitProgress(chunkProgress + Math.round(70 / chunks.length), `Chunk ${chunkNumber}/${chunks.length} complete`);

                console.log(
                    `[WORKFLOW:BATCH] Chunk ${chunkNumber}/${chunks.length} complete: ` +
                        `${chunkResults.filter((r) => r.success).length}/${chunk.length} successful`,
                );
            }

            // Step 3: Update metrics
            await events.emitStepStarted('update-batch-metrics');
            await step.do('update-batch-metrics', {
                retries: { limit: 1, delay: '1 second' },
            }, async () => {
                console.log(`[WORKFLOW:BATCH] Updating batch metrics`);

                const metricsKey = 'workflow:batch:metrics';
                const existingMetrics = await this.env.METRICS.get(metricsKey, 'json') as {
                    totalBatches: number;
                    totalRequests: number;
                    successfulRequests: number;
                    failedRequests: number;
                    avgBatchSize: number;
                    avgDurationMs: number;
                } | null;

                const metrics = existingMetrics || {
                    totalBatches: 0,
                    totalRequests: 0,
                    successfulRequests: 0,
                    failedRequests: 0,
                    avgBatchSize: 0,
                    avgDurationMs: 0,
                };

                const totalDuration = Date.now() - startTime;
                metrics.totalBatches++;
                metrics.totalRequests += requests.length;
                metrics.successfulRequests += successful;
                metrics.failedRequests += failed;
                metrics.avgBatchSize = Math.round(metrics.totalRequests / metrics.totalBatches);
                metrics.avgDurationMs = Math.round(
                    (metrics.avgDurationMs * (metrics.totalBatches - 1) + totalDuration) /
                        metrics.totalBatches,
                );

                await this.env.METRICS.put(metricsKey, JSON.stringify(metrics), {
                    expirationTtl: 86400 * 7,
                });

                return { updated: true };
            });

            await events.emitStepCompleted('update-batch-metrics');

            const totalDuration = Date.now() - startTime;

            // Emit workflow completed event
            await events.emitProgress(100, 'Batch compilation complete');
            await events.emitWorkflowCompleted({
                successful,
                failed,
                totalDurationMs: totalDuration,
            });

            // Track workflow completed via Analytics Engine
            analytics.trackWorkflowCompleted({
                requestId: batchId,
                workflowId: batchId,
                workflowType: 'batch',
                durationMs: totalDuration,
                itemCount: requests.length,
                successCount: successful,
            });

            console.log(
                `[WORKFLOW:BATCH] Batch workflow completed: ${successful}/${requests.length} successful ` +
                    `in ${totalDuration}ms (batchId: ${batchId})`,
            );

            return {
                batchId,
                totalRequests: requests.length,
                successful,
                failed,
                results,
                totalDurationMs: totalDuration,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[WORKFLOW:BATCH] Batch workflow failed (batchId: ${batchId}):`, errorMessage);

            // Track workflow failed via Analytics Engine
            analytics.trackWorkflowFailed({
                requestId: batchId,
                workflowId: batchId,
                workflowType: 'batch',
                durationMs: Date.now() - startTime,
                error: errorMessage,
            });

            // Emit workflow failed event
            await events.emitWorkflowFailed(errorMessage, {
                successful,
                failed: requests.length - successful,
                totalDurationMs: Date.now() - startTime,
            });

            return {
                batchId,
                totalRequests: requests.length,
                successful,
                failed: requests.length - successful,
                results,
                totalDurationMs: Date.now() - startTime,
            };
        }
    }
}
