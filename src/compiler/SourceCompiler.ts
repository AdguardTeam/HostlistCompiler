import { FilterDownloader } from '../downloader/index.ts';
import { ILogger, ISource, TransformationType } from '../types/index.ts';
import { TransformationPipeline } from '../transformations/index.ts';
import { logger as defaultLogger } from '../utils/logger.ts';

/**
 * Compiles an individual source according to its configuration.
 */
export class SourceCompiler {
    private readonly logger: ILogger;
    private readonly pipeline: TransformationPipeline;

    constructor(pipeline?: TransformationPipeline, logger?: ILogger) {
        this.logger = logger || defaultLogger;
        this.pipeline = pipeline || new TransformationPipeline(undefined, this.logger);
    }

    /**
     * Compiles a single source.
     * @param source - Source configuration
     * @returns Array of compiled rules
     */
    public async compile(source: ISource): Promise<string[]> {
        this.logger.info(`Start compiling ${source.source}`);

        // Download the source
        let rules = await FilterDownloader.download(
            source.source,
            {},
            { allowEmptyResponse: true },
        );

        this.logger.info(`Original length is ${rules.length}`);

        // Apply transformations
        const transformations = source.transformations || [];
        rules = await this.pipeline.transform(
            rules,
            source,
            transformations as TransformationType[],
        );

        this.logger.info(`Length after applying transformations is ${rules.length}`);
        return rules;
    }
}
