import consola from 'consola';
import { IConfiguration, ILogger, ISource, TransformationType } from '../types';
import { ConfigurationValidator } from '../configuration';
import { TransformationPipeline } from '../transformations';
import { SourceCompiler } from './SourceCompiler';

// Import package.json for version info
import packageJson from '../../package.json';

/**
 * Main compiler class for hostlist compilation.
 * Orchestrates the entire compilation process.
 */
export class FilterCompiler {
    private readonly logger: ILogger;
    private readonly validator: ConfigurationValidator;
    private readonly pipeline: TransformationPipeline;
    private readonly sourceCompiler: SourceCompiler;

    constructor(logger?: ILogger) {
        this.logger = logger || consola;
        this.validator = new ConfigurationValidator();
        this.pipeline = new TransformationPipeline(undefined, this.logger);
        this.sourceCompiler = new SourceCompiler(this.pipeline, this.logger);
    }

    /**
     * Compiles a filter list using the specified configuration.
     * @param configuration - Compilation configuration
     * @returns Array of compiled rules
     */
    public async compile(configuration: IConfiguration): Promise<string[]> {
        this.logger.info('Starting the compiler');

        // Validate configuration
        const validationResult = this.validator.validate(configuration);
        if (!validationResult.valid) {
            this.logger.info(validationResult.errorsText || 'Unknown validation error');
            throw new Error('Failed to validate configuration');
        }

        this.logger.info(`Configuration: ${JSON.stringify(configuration, null, 4)}`);

        // Compile all sources
        let finalList: string[] = [];

        for (const source of configuration.sources) {
            const sourceRules = await this.sourceCompiler.compile(source);
            const sourceHeader = this.prepareSourceHeader(source);

            finalList = finalList.concat(sourceHeader);
            finalList = finalList.concat(sourceRules);
        }

        // Apply global transformations
        const transformations = configuration.transformations || [];
        finalList = await this.pipeline.transform(
            finalList,
            configuration,
            transformations as TransformationType[],
        );

        // Prepend the list header
        const header = this.prepareHeader(configuration);
        this.logger.info(`Final length of the list is ${header.length + finalList.length}`);

        return header.concat(finalList);
    }

    /**
     * Prepares the main list header.
     */
    private prepareHeader(configuration: IConfiguration): string[] {
        const lines = [
            '!',
            `! Title: ${configuration.name}`,
        ];

        if (configuration.description) {
            lines.push(`! Description: ${configuration.description}`);
        }
        if (configuration.version) {
            lines.push(`! Version: ${configuration.version}`);
        }
        if (configuration.homepage) {
            lines.push(`! Homepage: ${configuration.homepage}`);
        }
        if (configuration.license) {
            lines.push(`! License: ${configuration.license}`);
        }

        lines.push(`! Last modified: ${new Date().toISOString()}`);
        lines.push('!');

        // Compiler info
        lines.push(`! Compiled by ${packageJson.name} v${packageJson.version}`);
        lines.push('!');

        return lines;
    }

    /**
     * Prepares the source header.
     */
    private prepareSourceHeader(source: ISource): string[] {
        const lines = ['!'];

        if (source.name) {
            lines.push(`! Source name: ${source.name}`);
        }
        lines.push(`! Source: ${source.source}`);
        lines.push('!');

        return lines;
    }
}

/**
 * Convenience function for compiling a filter list.
 * Maintains backward compatibility with the original API.
 */
export async function compile(configuration: IConfiguration): Promise<string[]> {
    const compiler = new FilterCompiler();
    return compiler.compile(configuration);
}
