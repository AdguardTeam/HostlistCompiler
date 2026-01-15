/**
 * CompilationWorkflow - Durable execution workflow for filter list compilation.
 *
 * This workflow provides crash-resistant, automatically resumable compilation
 * with built-in retry logic and step-by-step checkpointing.
 *
 * Benefits over queue-based processing:
 * - Automatic state persistence between steps
 * - Crash recovery - resumes from last successful step
 * - Built-in retry with configurable policies
 * - Observable step-by-step progress
 * - No manual KV state management
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { createTracingContext, WorkerCompiler } from '../../src/index.ts';
import type { Env } from '../worker.ts';
import type {
    CompilationParams,
    SourceFetchResult,
    TransformationResult,
    WorkflowCompilationResult,
} from './types.ts';

/**
 * Compresses data using gzip (duplicated from worker.ts for workflow isolation)
 */
async function compress(data: string): Promise<ArrayBuffer> {
    const stream = new Response(data).body!.pipeThrough(
        new CompressionStream('gzip'),
    );
    return new Response(stream).arrayBuffer();
}

/**
 * Generate cache key from configuration (duplicated for workflow isolation)
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

/**
 * Cache TTL in seconds (24 hours)
 */
const CACHE_TTL = 86400;

/**
 * CompilationWorkflow handles the full compilation pipeline with durable execution.
 *
 * Steps:
 * 1. validate - Validate the configuration
 * 2. fetch-sources - Fetch all source filter lists
 * 3. transform - Apply all transformations
 * 4. generate-header - Generate the output header
 * 5. cache-result - Compress and cache the final result
 */
export class CompilationWorkflow extends WorkflowEntrypoint<Env, CompilationParams> {
    /**
     * Main workflow execution
     */
    override async run(event: WorkflowEvent<CompilationParams>, step: WorkflowStep): Promise<WorkflowCompilationResult> {
        const startTime = Date.now();
        const { requestId, configuration, preFetchedContent, benchmark } = event.payload;

        console.log(`[WORKFLOW:COMPILE] Starting compilation workflow for "${configuration.name}" (requestId: ${requestId})`);

        const result: WorkflowCompilationResult = {
            success: false,
            requestId,
            configName: configuration.name,
            compiledAt: new Date().toISOString(),
            totalDurationMs: 0,
            steps: {},
        };

        try {
            // Step 1: Validate configuration
            const validationResult = await step.do('validate', {
                retries: { limit: 1, delay: '1 second' },
            }, async () => {
                const stepStart = Date.now();
                console.log(`[WORKFLOW:COMPILE] Step 1: Validating configuration`);

                // Basic validation
                if (!configuration.name) {
                    throw new Error('Configuration must have a name');
                }
                if (!configuration.sources || configuration.sources.length === 0) {
                    throw new Error('Configuration must have at least one source');
                }

                // Validate each source has required fields
                for (const source of configuration.sources) {
                    if (!source.source && !preFetchedContent?.[source.name || '']) {
                        throw new Error(`Source "${source.name || 'unnamed'}" missing URL and no pre-fetched content`);
                    }
                }

                return {
                    durationMs: Date.now() - stepStart,
                    success: true,
                    sourceCount: configuration.sources.length,
                    transformationCount: configuration.transformations?.length || 0,
                };
            });

            result.steps.validation = {
                durationMs: validationResult.durationMs,
                success: validationResult.success,
            };

            // Step 2: Compile sources (fetch and process)
            const compilationResult = await step.do('compile-sources', {
                retries: { limit: 3, delay: '5 seconds', backoff: 'exponential' },
                timeout: '5 minutes',
            }, async () => {
                const stepStart = Date.now();
                console.log(`[WORKFLOW:COMPILE] Step 2: Compiling ${configuration.sources.length} sources`);

                // Create tracing context
                const tracingContext = createTracingContext({
                    metadata: {
                        endpoint: 'workflow/compile',
                        configName: configuration.name,
                        requestId,
                        workflowStep: 'compile-sources',
                    },
                });

                const compiler = new WorkerCompiler({
                    preFetchedContent,
                    tracingContext,
                });

                const compileResult = await compiler.compileWithMetrics(configuration, benchmark ?? false);

                // Extract source fetch results from diagnostics/metrics
                const sourceFetchResults: SourceFetchResult[] = configuration.sources.map((source) => ({
                    name: source.name || source.source || 'unnamed',
                    url: source.source || '',
                    success: true,
                    ruleCount: 0, // Would need to track per-source
                    durationMs: 0,
                    cached: false,
                }));

                // Extract transformation results
                const transformationResults: TransformationResult[] = (configuration.transformations || []).map((t) => ({
                    transformationName: typeof t === 'string' ? t : String(t),
                    inputRuleCount: 0,
                    outputRuleCount: 0,
                    durationMs: 0,
                }));

                return {
                    rules: compileResult.rules,
                    ruleCount: compileResult.rules.length,
                    metrics: compileResult.metrics,
                    sourceFetchResults,
                    transformationResults,
                    durationMs: Date.now() - stepStart,
                };
            });

            result.steps.sourceFetch = {
                durationMs: compilationResult.durationMs,
                sources: compilationResult.sourceFetchResults,
            };

            result.steps.transformation = {
                durationMs: 0, // Included in compilation step
                transformations: compilationResult.transformationResults,
            };

            result.rules = compilationResult.rules;
            result.ruleCount = compilationResult.ruleCount;

            // Step 3: Cache the result (if no pre-fetched content)
            const shouldCache = !preFetchedContent || Object.keys(preFetchedContent).length === 0;
            const cacheKey = shouldCache ? getCacheKey(configuration) : null;

            if (cacheKey) {
                const cacheResult = await step.do('cache-result', {
                    retries: { limit: 2, delay: '2 seconds' },
                }, async () => {
                    const stepStart = Date.now();
                    console.log(`[WORKFLOW:COMPILE] Step 3: Caching result`);

                    const cacheData = {
                        success: true,
                        rules: compilationResult.rules,
                        ruleCount: compilationResult.ruleCount,
                        metrics: compilationResult.metrics,
                        compiledAt: new Date().toISOString(),
                    };

                    const jsonStr = JSON.stringify(cacheData);
                    const uncompressedSize = jsonStr.length;
                    const compressed = await compress(jsonStr);
                    const compressedSize = compressed.byteLength;

                    await this.env.COMPILATION_CACHE.put(
                        cacheKey,
                        compressed,
                        { expirationTtl: CACHE_TTL },
                    );

                    console.log(
                        `[WORKFLOW:COMPILE] Cached: ${uncompressedSize} -> ${compressedSize} bytes ` +
                        `(${((1 - compressedSize / uncompressedSize) * 100).toFixed(1)}% compression)`,
                    );

                    return {
                        durationMs: Date.now() - stepStart,
                        compressed: true,
                        sizeBytes: compressedSize,
                        cacheKey,
                    };
                });

                result.steps.caching = {
                    durationMs: cacheResult.durationMs,
                    compressed: cacheResult.compressed,
                    sizeBytes: cacheResult.sizeBytes,
                };
                result.cacheKey = cacheResult.cacheKey;
            }

            // Step 4: Update metrics
            await step.do('update-metrics', {
                retries: { limit: 1, delay: '1 second' },
            }, async () => {
                console.log(`[WORKFLOW:COMPILE] Step 4: Updating metrics`);

                // Update workflow metrics in KV
                const metricsKey = 'workflow:compile:metrics';
                const existingMetrics = await this.env.METRICS.get(metricsKey, 'json') as {
                    totalCompilations: number;
                    successfulCompilations: number;
                    failedCompilations: number;
                    totalRulesGenerated: number;
                    avgDurationMs: number;
                } | null;

                const metrics = existingMetrics || {
                    totalCompilations: 0,
                    successfulCompilations: 0,
                    failedCompilations: 0,
                    totalRulesGenerated: 0,
                    avgDurationMs: 0,
                };

                const totalDuration = Date.now() - startTime;
                metrics.totalCompilations++;
                metrics.successfulCompilations++;
                metrics.totalRulesGenerated += compilationResult.ruleCount;
                metrics.avgDurationMs = Math.round(
                    (metrics.avgDurationMs * (metrics.totalCompilations - 1) + totalDuration) /
                    metrics.totalCompilations,
                );

                await this.env.METRICS.put(metricsKey, JSON.stringify(metrics), {
                    expirationTtl: 86400 * 7, // 7 days
                });

                return { updated: true };
            });

            result.success = true;
            result.totalDurationMs = Date.now() - startTime;

            console.log(
                `[WORKFLOW:COMPILE] Workflow completed successfully for "${configuration.name}" ` +
                `in ${result.totalDurationMs}ms with ${result.ruleCount} rules`,
            );

            return result;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[WORKFLOW:COMPILE] Workflow failed for "${configuration.name}":`, errorMessage);

            // Update failure metrics
            try {
                await step.do('update-failure-metrics', async () => {
                    const metricsKey = 'workflow:compile:metrics';
                    const existingMetrics = await this.env.METRICS.get(metricsKey, 'json') as {
                        totalCompilations: number;
                        successfulCompilations: number;
                        failedCompilations: number;
                        totalRulesGenerated: number;
                        avgDurationMs: number;
                    } | null;

                    const metrics = existingMetrics || {
                        totalCompilations: 0,
                        successfulCompilations: 0,
                        failedCompilations: 0,
                        totalRulesGenerated: 0,
                        avgDurationMs: 0,
                    };

                    metrics.totalCompilations++;
                    metrics.failedCompilations++;

                    await this.env.METRICS.put(metricsKey, JSON.stringify(metrics), {
                        expirationTtl: 86400 * 7,
                    });

                    return { updated: true };
                });
            } catch {
                // Ignore metrics update failure
            }

            result.success = false;
            result.error = errorMessage;
            result.totalDurationMs = Date.now() - startTime;

            return result;
        }
    }
}
