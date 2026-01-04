import { FilterDownloader } from '../downloader/index.ts';
import { ILogger, ISource, TransformationType } from '../types/index.ts';
import { TransformationPipeline } from '../transformations/index.ts';
import { logger as defaultLogger, CompilerEventEmitter, createEventEmitter, stripUpstreamHeaders } from '../utils/index.ts';

/**
 * Compiles an individual source according to its configuration.
 */
export class SourceCompiler {
    private readonly logger: ILogger;
    private readonly pipeline: TransformationPipeline;
    private readonly eventEmitter: CompilerEventEmitter;

    constructor(pipeline?: TransformationPipeline, logger?: ILogger, eventEmitter?: CompilerEventEmitter) {
        this.logger = logger || defaultLogger;
        this.eventEmitter = eventEmitter || createEventEmitter();
        this.pipeline = pipeline || new TransformationPipeline(undefined, this.logger, this.eventEmitter);
    }

    /**
     * Compiles a single source.
     * @param source - Source configuration
     * @param sourceIndex - Index of this source in the configuration (for event reporting)
     * @param totalSources - Total number of sources being compiled (for event reporting)
     * @returns Array of compiled rules
     */
    public async compile(source: ISource, sourceIndex: number = 0, totalSources: number = 1): Promise<string[]> {
        const startTime = performance.now();

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
            message: `Compiling source: ${source.name || source.source}`,
        });

        this.logger.info(`Start compiling ${source.source}`);

        try {
            // Download the source
            let rules = await FilterDownloader.download(
                source.source,
                {},
                { allowEmptyResponse: true },
            );

            this.logger.info(`Original length is ${rules.length}`);

            // Strip upstream metadata headers to avoid redundancy
            rules = stripUpstreamHeaders(rules);
            this.logger.info(`Length after stripping upstream headers is ${rules.length}`);

            // Apply transformations
            const transformations = source.transformations || [];
            rules = await this.pipeline.transform(
                rules,
                source,
                transformations as TransformationType[],
            );

            this.logger.info(`Length after applying transformations is ${rules.length}`);

            const durationMs = performance.now() - startTime;

            // Emit source complete event
            this.eventEmitter.emitSourceComplete({
                source,
                sourceIndex,
                totalSources,
                ruleCount: rules.length,
                durationMs,
            });

            return rules;
        } catch (error) {
            // Emit source error event
            this.eventEmitter.emitSourceError({
                source,
                sourceIndex,
                totalSources,
                error: error instanceof Error ? error : new Error(String(error)),
            });

            throw error;
        }
    }
}
