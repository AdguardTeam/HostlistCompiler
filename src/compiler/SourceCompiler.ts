import { FilterDownloader } from '../downloader/index.ts';
import { ILogger, ISource, TransformationType } from '../types/index.ts';
import { TransformationPipeline } from '../transformations/index.ts';
import { CompilerEventEmitter, createEventEmitter, ErrorUtils, logger as defaultLogger, SourceError, stripUpstreamHeaders } from '../utils/index.ts';
import type { IDiagnosticsCollector } from '../diagnostics/types.ts';
import { NoOpDiagnosticsCollector } from '../diagnostics/DiagnosticsCollector.ts';

/**
 * Options for configuring the SourceCompiler.
 */
export interface SourceCompilerOptions {
    /** Transformation pipeline to use */
    pipeline?: TransformationPipeline;
    /** Logger for output messages */
    logger?: ILogger;
    /** Event emitter for observability */
    eventEmitter?: CompilerEventEmitter;
    /** Diagnostics collector for tracing */
    diagnostics?: IDiagnosticsCollector;
}

/**
 * Compiles an individual source according to its configuration.
 * Supports tracing and diagnostics for observability.
 */
export class SourceCompiler {
    private readonly logger: ILogger;
    private readonly pipeline: TransformationPipeline;
    private readonly eventEmitter: CompilerEventEmitter;
    private readonly diagnostics: IDiagnosticsCollector;

    /**
     * Creates a new SourceCompiler with options
     * @param options - Compiler options
     */
    constructor(options?: SourceCompilerOptions);
    /**
     * Creates a new SourceCompiler with legacy parameters
     * @deprecated Use options object instead
     * @param pipeline - Optional transformation pipeline
     * @param logger - Optional logger
     * @param eventEmitter - Optional event emitter
     */
    constructor(pipeline?: TransformationPipeline, logger?: ILogger, eventEmitter?: CompilerEventEmitter);
    constructor(
        pipelineOrOptions?: TransformationPipeline | SourceCompilerOptions,
        logger?: ILogger,
        eventEmitter?: CompilerEventEmitter,
    ) {
        // Handle both old signature and new options object
        if (
            pipelineOrOptions instanceof TransformationPipeline || logger !== undefined ||
            eventEmitter !== undefined
        ) {
            // Legacy signature: (pipeline?: TransformationPipeline, logger?: ILogger, eventEmitter?: CompilerEventEmitter)
            this.logger = logger ?? defaultLogger;
            this.eventEmitter = eventEmitter ?? createEventEmitter();
            this.diagnostics = NoOpDiagnosticsCollector.getInstance();
            this.pipeline = (pipelineOrOptions as TransformationPipeline | undefined) ??
                new TransformationPipeline(undefined, this.logger, this.eventEmitter);
        } else {
            // New options object signature: (options?: SourceCompilerOptions)
            const options: SourceCompilerOptions = (pipelineOrOptions ?? {}) as SourceCompilerOptions;
            this.logger = options.logger ?? defaultLogger;
            this.eventEmitter = options.eventEmitter ?? createEventEmitter();
            this.diagnostics = options.diagnostics ?? NoOpDiagnosticsCollector.getInstance();
            this.pipeline = options.pipeline ?? new TransformationPipeline(undefined, this.logger, this.eventEmitter);
        }
    }

    /**
     * Compiles a single source.
     * @param source - Source configuration
     * @param sourceIndex - Index of this source in the configuration (for event reporting)
     * @param totalSources - Total number of sources being compiled (for event reporting)
     * @returns Array of compiled rules
     * @throws SourceError if compilation fails
     */
    public async compile(source: ISource, sourceIndex: number = 0, totalSources: number = 1): Promise<string[]> {
        const startTime = performance.now();
        const sourceName = source.name ?? source.source;

        // Start tracing this source compilation
        const operationId = this.diagnostics.operationStart('compileSource', {
            source: sourceName,
            sourceIndex,
            totalSources,
        });

        // Emit source start event
        this.eventEmitter.emitSourceStart({
            source,
            sourceIndex,
            totalSources,
        });

        // Emit progress event
        this.eventEmitter.emitProgress({
            phase: 'sources',
            current: sourceIndex + 1,
            total: totalSources,
            message: `Compiling source: ${sourceName}`,
        });

        this.logger.info(`Start compiling ${source.source}`);

        try {
            // Download the source with tracing
            const downloadEventId = this.diagnostics.operationStart('downloadSource', {
                source: source.source,
            });

            let rules: string[];
            try {
                rules = await FilterDownloader.download(
                    source.source,
                    {},
                    { allowEmptyResponse: true },
                );
                this.diagnostics.operationComplete(downloadEventId, {
                    ruleCount: rules.length,
                });
            } catch (downloadError) {
                this.diagnostics.operationError(downloadEventId, ErrorUtils.toError(downloadError));
                throw ErrorUtils.sourceDownloadError(source.source, ErrorUtils.toError(downloadError));
            }

            this.logger.info(`Original length is ${rules.length}`);
            this.diagnostics.recordMetric('sourceRulesDownloaded', rules.length, 'rules', {
                source: sourceName,
            });

            // Strip upstream metadata headers to avoid redundancy
            const beforeStrip = rules.length;
            rules = stripUpstreamHeaders(rules);
            this.logger.info(`Length after stripping upstream headers is ${rules.length}`);

            if (beforeStrip !== rules.length) {
                this.diagnostics.recordMetric('headersStripped', beforeStrip - rules.length, 'lines', {
                    source: sourceName,
                });
            }

            // Apply transformations with tracing
            const transformations = source.transformations ?? [];
            if (transformations.length > 0) {
                const transformEventId = this.diagnostics.operationStart('applySourceTransformations', {
                    source: sourceName,
                    transformationCount: transformations.length,
                    inputRuleCount: rules.length,
                });

                try {
                    rules = await this.pipeline.transform(
                        rules,
                        source,
                        transformations as TransformationType[],
                    );
                    this.diagnostics.operationComplete(transformEventId, {
                        outputRuleCount: rules.length,
                    });
                } catch (transformError) {
                    this.diagnostics.operationError(transformEventId, ErrorUtils.toError(transformError));
                    throw transformError;
                }
            }

            this.logger.info(`Length after applying transformations is ${rules.length}`);

            const durationMs = performance.now() - startTime;

            // Record final metrics
            this.diagnostics.recordMetric('sourceCompilationDuration', durationMs, 'ms', {
                source: sourceName,
            });
            this.diagnostics.recordMetric('sourceOutputRules', rules.length, 'rules', {
                source: sourceName,
            });

            // Emit source complete event
            this.eventEmitter.emitSourceComplete({
                source,
                sourceIndex,
                totalSources,
                ruleCount: rules.length,
                durationMs,
            });

            // Complete tracing
            this.diagnostics.operationComplete(operationId, {
                ruleCount: rules.length,
                durationMs,
            });

            return rules;
        } catch (error) {
            const durationMs = performance.now() - startTime;
            const normalizedError = error instanceof SourceError ? error : new SourceError(
                `Failed to compile source: ${ErrorUtils.getMessage(error)}`,
                source.source,
                ErrorUtils.toError(error),
            );

            // Record error in diagnostics
            this.diagnostics.operationError(operationId, normalizedError);

            // Emit source error event
            this.eventEmitter.emitSourceError({
                source,
                sourceIndex,
                totalSources,
                error: normalizedError,
            });

            this.logger.error(`Source compilation failed after ${durationMs.toFixed(2)}ms: ${normalizedError.message}`);

            throw normalizedError;
        }
    }
}
