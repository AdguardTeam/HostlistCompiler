#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net
// deno-lint-ignore-file no-console

import { parseArgs } from '@std/cli/parse-args';
import {
    ICompilationCompleteEvent,
    ICompilerEvents,
    IConfiguration,
    ILogger,
    IProgressEvent,
    ISource,
    ISourceCompleteEvent,
    ISourceErrorEvent,
    ISourceStartEvent,
    ITransformationCompleteEvent,
    SourceType,
    TransformationType,
} from '../types/index.ts';
import { FilterCompiler, FilterCompilerOptions } from '../compiler/index.ts';
import { formatDuration } from '../utils/index.ts';

// Log level constants
const LOG_LEVEL_ERROR = 1;
const LOG_LEVEL_WARN = 2;
const LOG_LEVEL_INFO = 3;
const LOG_LEVEL_DEBUG = 4;
const LOG_LEVEL_TRACE = 5;

/**
 * Get version from deno.json
 */
async function getVersion(): Promise<string> {
    try {
        const denoConfig = JSON.parse(await Deno.readTextFile('./deno.json'));
        return denoConfig.version || '0.0.0';
    } catch {
        return '0.0.0';
    }
}

const VERSION = await getVersion();

/**
 * CLI arguments interface
 */
interface ICliArgs {
    config?: string;
    input?: string[];
    'input-type'?: string;
    output?: string;
    verbose?: boolean;
    benchmark?: boolean;
    progress?: boolean;
    help?: boolean;
    version?: boolean;
}

/**
 * Simple console logger compatible with ILogger interface
 * Extended with additional consola-compatible methods
 */
class ConsoleLogger implements ILogger {
    private level: number = LOG_LEVEL_INFO; // info level by default

    setLevel(level: number): void {
        this.level = level;
    }

    trace(message: string): void {
        if (this.level >= LOG_LEVEL_TRACE) console.log('[TRACE]', message);
    }

    debug(message: string): void {
        if (this.level >= LOG_LEVEL_DEBUG) console.log('[DEBUG]', message);
    }

    info(message: string): void {
        if (this.level >= LOG_LEVEL_INFO) console.log('[INFO]', message);
    }

    warn(message: string): void {
        if (this.level >= LOG_LEVEL_WARN) console.warn('[WARN]', message);
    }

    error(message: string): void {
        if (this.level >= LOG_LEVEL_ERROR) console.error('[ERROR]', message);
    }

    // Additional consola-compatible methods (not in ILogger interface)
    fatal(message: string): void {
        console.error('[FATAL]', message);
    }

    success(message: string): void {
        if (this.level >= LOG_LEVEL_INFO) console.log('[SUCCESS]', message);
    }

    log(message: string): void {
        console.log(message);
    }
}

/**
 * Command-line interface application for the hostlist compiler.
 */
export class CliApp {
    private readonly logger: ILogger;
    private compiler!: FilterCompiler;
    private args!: ICliArgs;

    constructor(logger?: ILogger) {
        this.logger = logger || new ConsoleLogger();
    }

    /**
     * Creates event handlers for progress reporting.
     */
    private createEventHandlers(): ICompilerEvents {
        return {
            onSourceStart: (event: ISourceStartEvent) => {
                const name = event.source.name || event.source.source;
                console.log(`  [${event.sourceIndex + 1}/${event.totalSources}] Starting: ${name}`);
            },
            onSourceComplete: (event: ISourceCompleteEvent) => {
                const name = event.source.name || event.source.source;
                console.log(`  [${event.sourceIndex + 1}/${event.totalSources}] Complete: ${name} (${event.ruleCount} rules, ${formatDuration(event.durationMs)})`);
            },
            onSourceError: (event: ISourceErrorEvent) => {
                const name = event.source.name || event.source.source;
                console.error(`  [${event.sourceIndex + 1}/${event.totalSources}] Error: ${name} - ${event.error.message}`);
            },
            onTransformationComplete: (event: ITransformationCompleteEvent) => {
                const delta = event.outputCount - event.inputCount;
                const deltaStr = delta === 0 ? '' : ` (${delta > 0 ? '+' : ''}${delta})`;
                console.log(`  Transform: ${event.name} -> ${event.outputCount} rules${deltaStr}, ${formatDuration(event.durationMs)}`);
            },
            onProgress: (event: IProgressEvent) => {
                this.logger.debug(`Progress [${event.phase}]: ${event.current}/${event.total} - ${event.message}`);
            },
            onCompilationComplete: (event: ICompilationCompleteEvent) => {
                console.log(`\nCompilation complete:`);
                console.log(`  Sources: ${event.sourceCount}`);
                console.log(`  Transformations: ${event.transformationCount}`);
                console.log(`  Output rules: ${event.ruleCount}`);
                console.log(`  Total time: ${formatDuration(event.totalDurationMs)}`);
            },
        };
    }

    /**
     * Initializes the compiler with appropriate options.
     */
    private initCompiler(): void {
        const options: FilterCompilerOptions = {
            logger: this.logger,
        };

        if (this.args.progress) {
            options.events = this.createEventHandlers();
        }

        this.compiler = new FilterCompiler(options);
    }

    /**
     * Shows help message
     */
    private showHelp(): void {
        console.log(`
Usage: adblock-compiler [options]

Options:
  -c, --config <file>      Path to the compiler configuration file
  -i, --input <source>     URL (or path to a file) to convert to an AdGuard-syntax
                           blocklist. Can be specified multiple times.
  -t, --input-type <type>  Type of the input file (hosts|adblock) [default: hosts]
  -o, --output <file>      Path to the output file [required]
  -v, --verbose            Run with verbose logging
  -b, --benchmark          Show performance benchmark report
  -p, --progress           Show real-time progress events during compilation
  --version                Show version number
  -h, --help               Show help

Examples:
  adblock-compiler -c config.json -o output.txt
      compile a blocklist and write the output to output.txt

  adblock-compiler -i https://example.org/hosts.txt -o output.txt
      compile a blocklist from the URL and write the output to output.txt

  adblock-compiler -c config.json -o output.txt --benchmark
      compile and show performance metrics
`);
    }

    /**
     * Parses command-line arguments using Deno's std/cli.
     */
    private parseArgs(argv: string[]): ICliArgs {
        const parsed = parseArgs(argv, {
            string: ['config', 'input-type', 'output'],
            boolean: ['verbose', 'benchmark', 'help', 'version'],
            collect: ['input'],
            alias: {
                c: 'config',
                i: 'input',
                t: 'input-type',
                o: 'output',
                v: 'verbose',
                b: 'benchmark',
                h: 'help',
            },
        });

        return {
            config: parsed.config,
            input: parsed.input as string[] | undefined,
            'input-type': parsed['input-type'],
            output: parsed.output,
            verbose: parsed.verbose,
            benchmark: parsed.benchmark,
            help: parsed.help,
            version: parsed.version,
        };
    }

    /**
     * Reads the configuration file using Deno's file system API.
     *
     * NOTE: This currently doesn't validate the configuration schema.
     * In the full migration, this should use ConfigurationValidator
     * which validates against the JSON schema. For now, validation
     * will happen later when FilterCompiler.compile() is called.
     */
    private async readConfig(): Promise<IConfiguration> {
        this.logger.debug(`Reading configuration from ${this.args.config}`);

        try {
            const configStr = await Deno.readTextFile(this.args.config!);
            return JSON.parse(configStr) as IConfiguration;
        } catch (error) {
            if (error instanceof Deno.errors.NotFound) {
                throw new Error(`Configuration file not found: ${this.args.config}`);
            }
            throw error;
        }
    }

    /**
     * Creates a configuration from CLI input arguments.
     */
    private createConfig(): IConfiguration {
        const inputType = this.args['input-type'] || 'hosts';

        this.logger.debug(`Creating configuration for input ${this.args.input} of type ${inputType}`);

        const sources: ISource[] = (this.args.input || []).map((input) => ({
            source: input,
            type: inputType === 'adblock' ? SourceType.Adblock : SourceType.Hosts,
        }));

        const config: IConfiguration = {
            name: 'Blocklist',
            sources,
            transformations: [
                TransformationType.RemoveComments,
                TransformationType.Deduplicate,
                TransformationType.Compress,
                TransformationType.Validate,
                TransformationType.TrimLines,
                TransformationType.InsertFinalNewLine,
            ],
        };

        return config;
    }

    /**
     * Runs the CLI application.
     */
    public async run(argv: string[]): Promise<void> {
        try {
            this.args = this.parseArgs(argv);

            // Handle --version
            if (this.args.version) {
                console.log(`v${VERSION}`);
                return;
            }

            // Handle --help
            if (this.args.help) {
                this.showHelp();
                return;
            }

            // Set verbose logging
            if (this.args.verbose && this.logger instanceof ConsoleLogger) {
                this.logger.setLevel(LOG_LEVEL_TRACE);
            }

            this.logger.info(`Starting @jk-com/adblock-compiler v${VERSION}`);

            // Validate required arguments
            if (!this.args.input && !this.args.config) {
                throw new Error('Either --input or --config must be specified');
            }

            if (!this.args.output) {
                throw new Error('--output is required');
            }

            // Initialize compiler with optional event handlers
            this.initCompiler();

            // Get configuration
            const config = this.args.input ? this.createConfig() : await this.readConfig();

            this.logger.debug(`Configuration: ${JSON.stringify(config, null, 4)}`);

            // Compile with optional benchmarking
            const result = await this.compiler.compileWithMetrics(config, this.args.benchmark || false);

            // Write output using Deno's file system API
            this.logger.info(`Writing output to ${this.args.output}`);
            await Deno.writeTextFile(this.args.output, result.rules.join('\n'));
            this.logger.info('Finished compiling');
        } catch (error) {
            this.logger.error(error instanceof Error ? error.message : String(error));
            Deno.exit(1);
        }
    }
}

/**
 * Main entry point for CLI.
 */
export async function main(): Promise<void> {
    const app = new CliApp();
    await app.run(Deno.args);
}

// Run if this is the main module
if (import.meta.main) {
    await main();
}
