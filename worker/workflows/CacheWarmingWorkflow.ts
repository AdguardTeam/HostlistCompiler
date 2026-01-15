/**
 * CacheWarmingWorkflow - Scheduled workflow for pre-populating the compilation cache.
 *
 * This workflow can be triggered via cron or manually to ensure popular filter lists
 * are pre-compiled and cached, reducing latency for end users.
 *
 * Benefits:
 * - Reliable scheduled execution with durable timers
 * - Automatic retry on failures
 * - Individual configuration failures don't block others
 * - Built-in progress tracking and metrics
 */

import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { createTracingContext, type IConfiguration, TransformationType, WorkerCompiler } from '../../src/index.ts';
import { AnalyticsService } from '../../src/services/AnalyticsService.ts';
import type { Env } from '../worker.ts';
import type { CacheWarmingParams, CacheWarmingResult } from './types.ts';
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
 * Maximum concurrent cache warming operations
 */
const MAX_CONCURRENT = 2;

/**
 * Default popular configurations to warm (can be overridden via params)
 */
const DEFAULT_POPULAR_CONFIGS: IConfiguration[] = [
    {
        name: 'EasyList',
        sources: [{ source: 'https://easylist.to/easylist/easylist.txt', name: 'EasyList' }],
        transformations: [TransformationType.Deduplicate, TransformationType.RemoveEmptyLines, TransformationType.TrimLines],
    },
    {
        name: 'EasyPrivacy',
        sources: [{ source: 'https://easylist.to/easylist/easyprivacy.txt', name: 'EasyPrivacy' }],
        transformations: [TransformationType.Deduplicate, TransformationType.RemoveEmptyLines, TransformationType.TrimLines],
    },
    {
        name: 'AdGuard Base',
        sources: [{ source: 'https://filters.adtidy.org/extension/chromium/filters/2.txt', name: 'AdGuard Base' }],
        transformations: [TransformationType.Deduplicate, TransformationType.RemoveEmptyLines, TransformationType.TrimLines],
    },
];

/**
 * CacheWarmingWorkflow pre-compiles and caches popular filter lists.
 *
 * Steps:
 * 1. prepare-configs - Determine which configurations to warm
 * 2. warm-chunk-N - Process configurations in chunks
 * 3. report-results - Log results and update metrics
 */
export class CacheWarmingWorkflow extends WorkflowEntrypoint<Env, CacheWarmingParams> {
    /**
     * Main workflow execution
     */
    override async run(event: WorkflowEvent<CacheWarmingParams>, step: WorkflowStep): Promise<CacheWarmingResult> {
        const startTime = Date.now();
        const { runId, configurations, scheduled } = event.payload;

        // Initialize event emitter for real-time progress tracking
        const events = new WorkflowEvents(this.env.METRICS, runId, 'cache-warming');

        // Initialize analytics service
        const analytics = new AnalyticsService(this.env.ANALYTICS_ENGINE);

        // Use provided configurations or fall back to defaults
        const configsToWarm = configurations.length > 0 ? configurations : DEFAULT_POPULAR_CONFIGS;

        console.log(
            `[WORKFLOW:CACHE-WARM] Starting cache warming (runId: ${runId}, ` +
                `scheduled: ${scheduled}, configs: ${configsToWarm.length})`,
        );

        // Track workflow started via Analytics Engine
        analytics.trackWorkflowStarted({
            requestId: runId,
            workflowId: runId,
            workflowType: 'cache-warming',
            itemCount: configsToWarm.length,
        });

        // Emit workflow started event
        await events.emitWorkflowStarted({
            scheduled,
            configCount: configsToWarm.length,
        });

        const details: CacheWarmingResult['details'] = [];
        let warmedConfigurations = 0;
        let failedConfigurations = 0;

        try {
            // Step 1: Check which caches need refreshing
            await events.emitStepStarted('check-cache-status', { configCount: configsToWarm.length });
            const configsNeedingRefresh = await step.do('check-cache-status', {
                retries: { limit: 1, delay: '1 second' },
            }, async () => {
                console.log(`[WORKFLOW:CACHE-WARM] Checking cache status for ${configsToWarm.length} configs`);

                const needsRefresh: typeof configsToWarm = [];
                // Note: cacheThreshold would be used if KV exposed expiration metadata
                // const cacheThreshold = Date.now() - (CACHE_TTL * 1000 * 0.8);

                for (const config of configsToWarm) {
                    // Note: KV doesn't expose expiration, so we refresh all configs
                    // In production, you might store metadata with timestamps to check
                    // if the cache entry is still fresh using getCacheKey(config)
                    needsRefresh.push(config);
                }

                return needsRefresh;
            });

            await events.emitStepCompleted('check-cache-status', { needsRefresh: configsNeedingRefresh.length });

            if (configsNeedingRefresh.length === 0) {
                console.log(`[WORKFLOW:CACHE-WARM] All caches are fresh, nothing to warm`);
                await events.emitProgress(100, 'All caches are fresh');
                await events.emitWorkflowCompleted({ warmed: 0, skipped: configsToWarm.length });
                return {
                    runId,
                    scheduled,
                    warmedConfigurations: 0,
                    failedConfigurations: 0,
                    details: [],
                    totalDurationMs: Date.now() - startTime,
                };
            }

            await events.emitProgress(10, `${configsNeedingRefresh.length} configs need warming`);

            // Step 2: Process in chunks
            const chunks: Array<typeof configsNeedingRefresh> = [];
            for (let i = 0; i < configsNeedingRefresh.length; i += MAX_CONCURRENT) {
                chunks.push(configsNeedingRefresh.slice(i, i + MAX_CONCURRENT));
            }

            console.log(
                `[WORKFLOW:CACHE-WARM] Warming ${configsNeedingRefresh.length} configs in ${chunks.length} chunks`,
            );

            for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
                const chunk = chunks[chunkIndex];
                const chunkNumber = chunkIndex + 1;

                // Use sleep between chunks to avoid overwhelming external sources
                if (chunkIndex > 0) {
                    await step.sleep('inter-chunk-delay', '10 seconds');
                }

                await events.emitStepStarted(`warm-chunk-${chunkNumber}`, {
                    chunk: chunkNumber,
                    totalChunks: chunks.length,
                    configs: chunk.map((c) => c.name),
                });

                const chunkResults = await step.do(`warm-chunk-${chunkNumber}`, {
                    retries: { limit: 2, delay: '30 seconds', backoff: 'exponential' },
                    timeout: '15 minutes',
                }, async () => {
                    console.log(
                        `[WORKFLOW:CACHE-WARM] Processing chunk ${chunkNumber}/${chunks.length} ` +
                            `(${chunk.length} configs)`,
                    );

                    const results: CacheWarmingResult['details'] = [];

                    // Process sequentially within chunk to be nice to upstream servers
                    for (const config of chunk) {
                        const compileStart = Date.now();
                        try {
                            const tracingContext = createTracingContext({
                                metadata: {
                                    endpoint: 'workflow/cache-warm',
                                    configName: config.name,
                                    runId,
                                    scheduled: String(scheduled),
                                },
                            });

                            const compiler = new WorkerCompiler({ tracingContext });
                            const result = await compiler.compileWithMetrics(config, false);

                            // Cache the result
                            const cacheKey = getCacheKey(config);
                            const cacheData = {
                                success: true,
                                rules: result.rules,
                                ruleCount: result.rules.length,
                                metrics: result.metrics,
                                compiledAt: new Date().toISOString(),
                                warmedBy: runId,
                            };

                            const compressed = await compress(JSON.stringify(cacheData));
                            await this.env.COMPILATION_CACHE.put(
                                cacheKey,
                                compressed,
                                { expirationTtl: CACHE_TTL },
                            );

                            console.log(
                                `[WORKFLOW:CACHE-WARM] Warmed "${config.name}": ` +
                                    `${result.rules.length} rules in ${Date.now() - compileStart}ms`,
                            );

                            results.push({
                                configName: config.name,
                                success: true,
                                cacheKey,
                            });
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            console.error(
                                `[WORKFLOW:CACHE-WARM] Failed to warm "${config.name}":`,
                                errorMessage,
                            );

                            results.push({
                                configName: config.name,
                                success: false,
                                error: errorMessage,
                            });
                        }

                        // Small delay between compilations to be nice to upstream
                        await new Promise((resolve) => setTimeout(resolve, 2000));
                    }

                    return results;
                });

                // Aggregate results
                for (const result of chunkResults) {
                    details.push(result);
                    if (result.success) {
                        warmedConfigurations++;
                    } else {
                        failedConfigurations++;
                    }
                }

                await events.emitStepCompleted(`warm-chunk-${chunkNumber}`, {
                    warmed: chunkResults.filter((r) => r.success).length,
                    failed: chunkResults.filter((r) => !r.success).length,
                });

                const chunkProgress = 10 + Math.round(((chunkIndex + 1) / chunks.length) * 75);
                await events.emitProgress(chunkProgress, `Chunk ${chunkNumber}/${chunks.length} complete`);
            }

            // Step 3: Update metrics
            await events.emitStepStarted('update-warming-metrics');
            await step.do('update-warming-metrics', {
                retries: { limit: 1, delay: '1 second' },
            }, async () => {
                console.log(`[WORKFLOW:CACHE-WARM] Updating cache warming metrics`);

                const metricsKey = 'workflow:cache-warm:metrics';
                const existingMetrics = await this.env.METRICS.get(metricsKey, 'json') as {
                    totalRuns: number;
                    scheduledRuns: number;
                    manualRuns: number;
                    totalConfigsWarmed: number;
                    totalConfigsFailed: number;
                    lastRunAt: string;
                    avgDurationMs: number;
                } | null;

                const metrics = existingMetrics || {
                    totalRuns: 0,
                    scheduledRuns: 0,
                    manualRuns: 0,
                    totalConfigsWarmed: 0,
                    totalConfigsFailed: 0,
                    lastRunAt: '',
                    avgDurationMs: 0,
                };

                const totalDuration = Date.now() - startTime;
                metrics.totalRuns++;
                if (scheduled) {
                    metrics.scheduledRuns++;
                } else {
                    metrics.manualRuns++;
                }
                metrics.totalConfigsWarmed += warmedConfigurations;
                metrics.totalConfigsFailed += failedConfigurations;
                metrics.lastRunAt = new Date().toISOString();
                metrics.avgDurationMs = Math.round(
                    (metrics.avgDurationMs * (metrics.totalRuns - 1) + totalDuration) /
                        metrics.totalRuns,
                );

                await this.env.METRICS.put(metricsKey, JSON.stringify(metrics), {
                    expirationTtl: 86400 * 30, // 30 days
                });

                return { updated: true };
            });

            await events.emitStepCompleted('update-warming-metrics');

            const totalDuration = Date.now() - startTime;

            // Emit workflow completed event
            await events.emitProgress(100, 'Cache warming complete');
            await events.emitWorkflowCompleted({
                warmedConfigurations,
                failedConfigurations,
                totalDurationMs: totalDuration,
            });

            // Track workflow completed via Analytics Engine
            analytics.trackWorkflowCompleted({
                requestId: runId,
                workflowId: runId,
                workflowType: 'cache-warming',
                durationMs: totalDuration,
                itemCount: configsToWarm.length,
                successCount: warmedConfigurations,
            });

            console.log(
                `[WORKFLOW:CACHE-WARM] Cache warming completed: ${warmedConfigurations}/${configsToWarm.length} ` +
                    `successful in ${totalDuration}ms (runId: ${runId})`,
            );

            return {
                runId,
                scheduled,
                warmedConfigurations,
                failedConfigurations,
                details,
                totalDurationMs: totalDuration,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[WORKFLOW:CACHE-WARM] Cache warming workflow failed (runId: ${runId}):`, errorMessage);

            // Track workflow failed via Analytics Engine
            analytics.trackWorkflowFailed({
                requestId: runId,
                workflowId: runId,
                workflowType: 'cache-warming',
                durationMs: Date.now() - startTime,
                error: errorMessage,
            });

            // Emit workflow failed event
            await events.emitWorkflowFailed(errorMessage, {
                warmedConfigurations,
                failedConfigurations: configsToWarm.length - warmedConfigurations,
            });

            return {
                runId,
                scheduled,
                warmedConfigurations,
                failedConfigurations: configsToWarm.length - warmedConfigurations,
                details,
                totalDurationMs: Date.now() - startTime,
            };
        }
    }
}
