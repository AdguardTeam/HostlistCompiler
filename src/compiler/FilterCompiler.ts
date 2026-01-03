import { IConfiguration, ILogger, ISource, TransformationType, ICompilerEvents } from '../types/index.ts';
import { ConfigurationValidator } from '../configuration/index.ts';
import { TransformationPipeline } from '../transformations/index.ts';
import { SourceCompiler } from './SourceCompiler.ts';
import { logger as defaultLogger, BenchmarkCollector, CompilationMetrics, createEventEmitter, CompilerEventEmitter } from '../utils/index.ts';

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
    name: '@jk-com/adblock-compiler',
    version: '2.0.0',
} as const;

/**
 * Options for configuring the FilterCompiler.
 */
export interface FilterCompilerOptions {
    /** Logger for output messages */
    logger?: ILogger;
    /** Event handlers for observability */
    events?: ICompilerEvents;
}

/**
 * Main compiler class for hostlist compilation.
 * Orchestrates the entire compilation process using async operations throughout.
 */
export class FilterCompiler {
    private readonly logger: ILogger;
    private readonly validator: ConfigurationValidator;
    private readonly pipeline: TransformationPipeline;
    private readonly sourceCompiler: SourceCompiler;
    private readonly eventEmitter: CompilerEventEmitter;

    /**
     * Creates a new FilterCompiler instance.
     * 
     * @param optionsOrLogger - Compiler configuration options or legacy logger
     * 
     * @example
     * ```ts
     * // Modern API
     * const compiler = new FilterCompiler({
     *   logger: customLogger,
     *   events: {
     *     onProgress: (e) => console.log(`Progress: ${e.message}`),
     *   }
     * });
     * 
     * // Legacy API (still supported)
     * const compiler = new FilterCompiler(logger);
     * ```
     */
    constructor(optionsOrLogger?: FilterCompilerOptions | ILogger) {
        // Support both modern options object and legacy logger parameter
        if (optionsOrLogger && 'info' in optionsOrLogger) {
            // Legacy: ILogger passed directly
            this.logger = optionsOrLogger;
            this.eventEmitter = createEventEmitter();
        } else {
            // Modern: options object
            const options = optionsOrLogger as FilterCompilerOptions | undefined;
            this.logger = options?.logger ?? defaultLogger;
            this.eventEmitter = createEventEmitter(options?.events);
        }
        
        this.validator = new ConfigurationValidator();
        this.pipeline = new TransformationPipeline(undefined, this.logger, this.eventEmitter);
        this.sourceCompiler = new SourceCompiler(this.pipeline, this.logger, this.eventEmitter);
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
        const compilationStartTime = performance.now();

        this.logger.info('Starting the compiler');

        // Validate configuration
        const validationResult = this.validator.validate(configuration);
        if (!validationResult.valid) {
            this.logger.info(validationResult.errorsText || 'Unknown validation error');
            throw new Error('Failed to validate configuration');
        }

        this.logger.info(`Configuration: ${JSON.stringify(configuration, null, 4)}`);

        const totalSources = configuration.sources.length;

        // Compile all sources in parallel for better performance
        // Each source emits its own events through the SourceCompiler
        const sourceResults = await (collector
            ? collector.timeAsync(
                'Fetch & compile sources',
                () => Promise.all(
                    configuration.sources.map(async (source, index) => ({
                        source,
                        rules: await this.sourceCompiler.compile(source, index, totalSources),
                    })),
                ),
                (results) => results.reduce((sum, r) => sum + r.rules.length, 0),
            )
            : Promise.all(
                configuration.sources.map(async (source, index) => ({
                    source,
                    rules: await this.sourceCompiler.compile(source, index, totalSources),
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

        // Emit progress for transformation phase
        const transformations = configuration.transformations || [];
        this.eventEmitter.emitProgress({
            phase: 'transformations',
            current: 0,
            total: transformations.length,
            message: `Applying ${transformations.length} transformations`,
        });

        // Apply global transformations
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

        // Emit finalize progress
        this.eventEmitter.emitProgress({
            phase: 'finalize',
            current: 1,
            total: 1,
            message: 'Finalizing output',
        });

        // Prepend the list header and return combined result
        const header = this.prepareHeader(configuration);
        this.logger.info(`Final length of the list is ${header.length + finalList.length}`);

        const rules = [...header, ...finalList];
        collector?.setOutputRuleCount(rules.length);

        const metrics = collector?.finish();
        if (metrics) {
            this.logger.info(collector!.generateReport());
        }

        // Emit compilation complete event
        const totalDurationMs = performance.now() - compilationStartTime;
        this.eventEmitter.emitCompilationComplete({
            ruleCount: rules.length,
            totalDurationMs,
            sourceCount: totalSources,
            transformationCount: transformations.length,
        });

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
