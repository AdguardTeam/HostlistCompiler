/**
 * Web Worker / Cloudflare Worker compatible compiler.
 * Uses the platform abstraction layer for all I/O operations.
 * No file system access - all content must be fetched over HTTP or pre-provided.
 */

import type { ICompilerEvents, IConfiguration, ILogger, ISource, TransformationType } from '../types/index.ts';
import type { IContentFetcher, IPlatformCompilerOptions } from './types.ts';
import type { DiagnosticEvent, TracingContext } from '../diagnostics/index.ts';
import { ConfigurationValidator } from '../configuration/index.ts';
import { TransformationPipeline } from '../transformations/index.ts';
import { HeaderGenerator } from '../compiler/HeaderGenerator.ts';
import { addChecksumToHeader, BenchmarkCollector, CompilationMetrics, CompilerEventEmitter, createEventEmitter, silentLogger, stripUpstreamHeaders } from '../utils/index.ts';
import { createNoOpContext } from '../diagnostics/index.ts';
import { HttpFetcher } from './HttpFetcher.ts';
import { PreFetchedContentFetcher } from './PreFetchedContentFetcher.ts';
import { CompositeFetcher } from './CompositeFetcher.ts';
import { PlatformDownloader } from './PlatformDownloader.ts';

/**
 * Result of compilation with optional metrics and diagnostics.
 */
export interface WorkerCompilationResult {
    /** The compiled filter rules */
    rules: string[];
    /** Optional compilation metrics and timing data */
    metrics?: CompilationMetrics;
    /** Optional diagnostic events from compilation */
    diagnostics?: DiagnosticEvent[];
}

/**
 * Options for the WorkerCompiler.
 */
export interface WorkerCompilerOptions extends IPlatformCompilerOptions {
    /** Logger for output messages */
    logger?: ILogger;
    /** Event handlers for observability */
    events?: ICompilerEvents;
    /** Tracing context for diagnostics */
    tracingContext?: TracingContext;
}

/**
 * Web Worker / Cloudflare Worker compatible compiler.
 * Designed to run in environments without file system access.
 */
export class WorkerCompiler {
    private readonly logger: ILogger;
    private readonly validator: ConfigurationValidator;
    private readonly pipeline: TransformationPipeline;
    private readonly eventEmitter: CompilerEventEmitter;
    private readonly fetcher: IContentFetcher;
    private readonly headerGenerator: HeaderGenerator;
    private readonly tracingContext: TracingContext;

    /**
     * Creates a new WorkerCompiler
     * @param options - Optional compiler configuration
     */
    constructor(options?: WorkerCompilerOptions) {
        this.logger = options?.logger ?? silentLogger;
        this.eventEmitter = createEventEmitter(options?.events);
        this.tracingContext = options?.tracingContext ?? createNoOpContext();
        this.validator = new ConfigurationValidator();
        this.pipeline = new TransformationPipeline(undefined, this.logger, this.eventEmitter);
        this.headerGenerator = new HeaderGenerator();

        // Build the fetcher chain
        this.fetcher = this.buildFetcher(options);
    }

    /**
     * Builds the content fetcher based on options.
     */
    private buildFetcher(options?: WorkerCompilerOptions): IContentFetcher {
        // If a custom fetcher is provided, use it directly
        if (options?.customFetcher) {
            return options.customFetcher;
        }

        const fetchers: IContentFetcher[] = [];

        // Add pre-fetched content fetcher if content is provided
        if (options?.preFetchedContent) {
            fetchers.push(new PreFetchedContentFetcher(options.preFetchedContent));
        }

        // Add HTTP fetcher for URL-based sources
        fetchers.push(new HttpFetcher(options?.httpOptions));

        // If only one fetcher, use it directly
        if (fetchers.length === 1) {
            return fetchers[0];
        }

        // Otherwise, compose them
        return new CompositeFetcher(fetchers);
    }

    /**
     * Compiles a filter list using the specified configuration.
     * @param configuration - Compilation configuration
     * @returns Array of compiled rules
     */
    public async compile(configuration: IConfiguration): Promise<string[]> {
        const result = await this.compileWithMetrics(configuration, false);
        return result.rules;
    }

    /**
     * Compiles a filter list with optional performance metrics.
     * @param configuration - Compilation configuration
     * @param benchmark - Whether to collect performance metrics
     * @returns Compilation result with rules, optional metrics, and diagnostics
     */
    public async compileWithMetrics(
        configuration: IConfiguration,
        benchmark = false,
    ): Promise<WorkerCompilationResult> {
        const collector = benchmark ? new BenchmarkCollector() : null;
        collector?.start();
        const compilationStartTime = performance.now();

        // Start tracing compilation - use placeholder values until validation passes
        const compilationEventId = this.tracingContext.diagnostics.operationStart(
            'workerCompileFilterList',
            {
                name: (configuration as any)?.name || 'unknown',
                sourceCount: 0,
                transformationCount: 0,
            },
        );

        try {
            this.logger.info('Starting the compiler');

            // Trace validation
            const validationEventId = this.tracingContext.diagnostics.operationStart(
                'validateConfiguration',
                {
                    name: (configuration as any)?.name || 'unknown',
                },
            );

            const validationResult = this.validator.validate(configuration);
            if (!validationResult.valid) {
                this.tracingContext.diagnostics.operationError(
                    validationEventId,
                    new Error(validationResult.errorsText || 'Unknown validation error'),
                );
                this.logger.info(validationResult.errorsText || 'Unknown validation error');
                throw new Error('Failed to validate configuration');
            }

            this.tracingContext.diagnostics.operationComplete(validationEventId, { valid: true });

            const totalSources = configuration.sources.length;

            // Download and compile all sources in parallel
            const downloader = new PlatformDownloader(
                this.fetcher,
                { allowEmptyResponse: false },
                this.logger,
            );

            // Trace source compilation
            const sourcesEventId = this.tracingContext.diagnostics.operationStart(
                'compileSources',
                {
                    totalSources,
                },
            );

            const sourceResults = await (collector
                ? collector.timeAsync(
                    'Fetch & compile sources',
                    () =>
                        Promise.all(
                            configuration.sources.map(async (source, index) => {
                                this.eventEmitter.emitSourceStart({
                                    source,
                                    sourceIndex: index,
                                    totalSources,
                                });

                                const startTime = performance.now();
                                try {
                                    let rules = await downloader.download(source.source);

                                    // Strip upstream metadata headers to avoid redundancy
                                    rules = stripUpstreamHeaders(rules);

                                    // Apply source-level transformations
                                    const transformedRules = await this.applySourceTransformations(
                                        rules,
                                        source,
                                        configuration,
                                    );

                                    const durationMs = performance.now() - startTime;
                                    this.eventEmitter.emitSourceComplete({
                                        source,
                                        sourceIndex: index,
                                        totalSources,
                                        ruleCount: transformedRules.length,
                                        durationMs,
                                    });

                                    return { source, rules: transformedRules };
                                } catch (error) {
                                    this.eventEmitter.emitSourceError({
                                        source,
                                        sourceIndex: index,
                                        totalSources,
                                        error: error instanceof Error ? error : new Error(String(error)),
                                    });
                                    throw error;
                                }
                            }),
                        ),
                    (results) => results.reduce((sum, r) => sum + r.rules.length, 0),
                )
                : Promise.all(
                    configuration.sources.map(async (source, index) => {
                        this.eventEmitter.emitSourceStart({
                            source,
                            sourceIndex: index,
                            totalSources,
                        });

                        const startTime = performance.now();
                        try {
                            let rules = await downloader.download(source.source);

                            // Strip upstream metadata headers to avoid redundancy
                            rules = stripUpstreamHeaders(rules);

                            const transformedRules = await this.applySourceTransformations(
                                rules,
                                source,
                                configuration,
                            );

                            const durationMs = performance.now() - startTime;
                            this.eventEmitter.emitSourceComplete({
                                source,
                                sourceIndex: index,
                                totalSources,
                                ruleCount: transformedRules.length,
                                durationMs,
                            });

                            return { source, rules: transformedRules };
                        } catch (error) {
                            this.eventEmitter.emitSourceError({
                                source,
                                sourceIndex: index,
                                totalSources,
                                error: error instanceof Error ? error : new Error(String(error)),
                            });
                            throw error;
                        }
                    }),
                ));

            this.tracingContext.diagnostics.operationComplete(sourcesEventId, {
                totalRules: sourceResults.reduce((sum, r) => sum + r.rules.length, 0),
            });

            collector?.setSourceCount(configuration.sources.length);

            // Combine results with headers
            let finalList: string[] = [];
            for (const { source, rules } of sourceResults) {
                const sourceHeader = this.prepareSourceHeader(source);
                finalList.push(...sourceHeader, ...rules);
            }

            const inputRuleCount = finalList.length;
            collector?.setRuleCount(inputRuleCount);

            // Record metrics
            this.tracingContext.diagnostics.recordMetric('inputRuleCount', inputRuleCount, 'rules');

            // Apply global transformations
            const transformations = configuration.transformations || [];
            this.eventEmitter.emitProgress({
                phase: 'transformations',
                current: 0,
                total: transformations.length,
                message: `Applying ${transformations.length} transformations`,
            });

            // Trace transformations
            const transformEventId = this.tracingContext.diagnostics.operationStart(
                'applyTransformations',
                {
                    count: transformations.length,
                    inputRuleCount,
                },
            );

            finalList = await (collector
                ? collector.timeAsync(
                    'Apply transformations',
                    () =>
                        this.pipeline.transform(
                            finalList,
                            configuration,
                            transformations as TransformationType[],
                        ),
                    (result) => result.length,
                )
                : this.pipeline.transform(
                    finalList,
                    configuration,
                    transformations as TransformationType[],
                ));

            this.tracingContext.diagnostics.operationComplete(transformEventId, {
                outputRuleCount: finalList.length,
                reducedBy: inputRuleCount - finalList.length,
            });

            this.eventEmitter.emitProgress({
                phase: 'finalize',
                current: 1,
                total: 1,
                message: 'Finalizing output',
            });

            // Prepend header
            const header = this.prepareHeader(configuration);
            let rules = [...header, ...finalList];

            // Add checksum to the header
            rules = await addChecksumToHeader(rules);

            collector?.setOutputRuleCount(rules.length);

            const metrics = collector?.finish();

            // Record final metrics
            this.tracingContext.diagnostics.recordMetric('outputRuleCount', rules.length, 'rules');
            this.tracingContext.diagnostics.recordMetric(
                'compilationDuration',
                performance.now() - compilationStartTime,
                'ms',
            );

            // Emit completion event
            const totalDurationMs = performance.now() - compilationStartTime;
            this.eventEmitter.emitCompilationComplete({
                ruleCount: rules.length,
                totalDurationMs,
                sourceCount: totalSources,
                transformationCount: transformations.length,
            });

            // Complete compilation tracing
            this.tracingContext.diagnostics.operationComplete(compilationEventId, {
                ruleCount: rules.length,
                totalDurationMs,
            });

            return {
                rules,
                metrics,
                diagnostics: this.tracingContext.diagnostics.getEvents(),
            };
        } catch (error) {
            // Record compilation error
            this.tracingContext.diagnostics.operationError(compilationEventId, error as Error);
            throw error;
        }
    }

    /**
     * Applies source-level transformations.
     */
    private async applySourceTransformations(
        rules: string[],
        source: ISource,
        configuration: IConfiguration,
    ): Promise<string[]> {
        const sourceTransformations = source.transformations || [];
        if (sourceTransformations.length === 0) {
            return rules;
        }

        return this.pipeline.transform(
            rules,
            configuration,
            sourceTransformations as TransformationType[],
        );
    }

    /**
     * Prepares the main list header.
     */
    private prepareHeader(configuration: IConfiguration): string[] {
        return this.headerGenerator.generateListHeader(configuration);
    }

    /**
     * Prepares the source header.
     */
    private prepareSourceHeader(source: ISource): string[] {
        return this.headerGenerator.generateSourceHeader(source);
    }
}
