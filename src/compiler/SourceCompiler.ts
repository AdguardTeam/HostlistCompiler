import { FiltersDownloader } from '@adguard/filters-downloader';
import consola from 'consola';
import { ILogger, ISource, TransformationType } from '../types';
import { TransformationPipeline } from '../transformations';

/**
 * Compiles an individual source according to its configuration.
 */
export class SourceCompiler {
    private readonly logger: ILogger;
    private readonly pipeline: TransformationPipeline;

    constructor(pipeline?: TransformationPipeline, logger?: ILogger) {
        this.logger = logger || consola;
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
        let rules = await FiltersDownloader.download(
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
