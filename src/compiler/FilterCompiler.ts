import { IConfiguration, ILogger, ISource, TransformationType } from '../types/index.ts';
import { ConfigurationValidator } from '../configuration/index.ts';
import { TransformationPipeline } from '../transformations/index.ts';
import { SourceCompiler } from './SourceCompiler.ts';
import { logger as defaultLogger, BenchmarkCollector, CompilationMetrics } from '../utils/index.ts';

/**
 * Result of compilation with optional metrics.
 */
export interface CompilationResult {
    rules: string[];
    metrics?: CompilationMetrics;
}

/**
 * Package metadata for header generation.
 * Version matches deno.json for JSR publishing.
 */
const PACKAGE_INFO = {
    name: '@anthropic/hostlist-compiler',
    version: '2.0.0',
} as const;

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
        this.logger = logger || defaultLogger;
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
        const result = await this.compileWithMetrics(configuration, false);
        return result.rules;
    }

    /**
     * Compiles a filter list with optional performance metrics.
     * @param configuration - Compilation configuration
     * @param benchmark - Whether to collect performance metrics
     * @returns Compilation result with rules and optional metrics
     */
    public async compileWithMetrics(
        configuration: IConfiguration,
        benchmark: boolean = false,
    ): Promise<CompilationResult> {
        const collector = benchmark ? new BenchmarkCollector() : null;
        collector?.start();

        this.logger.info('Starting the compiler');

        // Validate configuration
        const validationResult = this.validator.validate(configuration);
        if (!validationResult.valid) {
            this.logger.info(validationResult.errorsText || 'Unknown validation error');
            throw new Error('Failed to validate configuration');
        }

        this.logger.info(`Configuration: ${JSON.stringify(configuration, null, 4)}`);

        // Compile all sources in parallel for better performance
        const sourceResults = await (collector
            ? collector.timeAsync(
                'Fetch & compile sources',
                () => Promise.all(
                    configuration.sources.map(async (source) => ({
                        source,
                        rules: await this.sourceCompiler.compile(source),
                    })),
                ),
                (results) => results.reduce((sum, r) => sum + r.rules.length, 0),
            )
            : Promise.all(
                configuration.sources.map(async (source) => ({
                    source,
                    rules: await this.sourceCompiler.compile(source),
                })),
            ));

        collector?.setSourceCount(configuration.sources.length);

        // Combine results maintaining order, using push for efficiency
        let finalList: string[] = [];
        for (const { source, rules } of sourceResults) {
            const sourceHeader = this.prepareSourceHeader(source);
            finalList.push(...sourceHeader, ...rules);
        }

        const inputRuleCount = finalList.length;
        collector?.setRuleCount(inputRuleCount);

        // Apply global transformations
        const transformations = configuration.transformations || [];
        finalList = await (collector
            ? collector.timeAsync(
                'Apply transformations',
                () => this.pipeline.transform(
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

        // Prepend the list header and return combined result
        const header = this.prepareHeader(configuration);
        this.logger.info(`Final length of the list is ${header.length + finalList.length}`);

        const rules = [...header, ...finalList];
        collector?.setOutputRuleCount(rules.length);

        const metrics = collector?.finish();
        if (metrics) {
            this.logger.info(collector!.generateReport());
        }

        return { rules, metrics };
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
        lines.push(`! Compiled by ${PACKAGE_INFO.name} v${PACKAGE_INFO.version}`);
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
