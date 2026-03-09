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
import type { DownloaderOptions } from '../downloader/index.ts';
import { ConfigurationSchema } from '../configuration/index.ts';
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
    stdout?: boolean;
    append?: boolean;
    format?: string;
    name?: string;
    'max-rules'?: number;
    verbose?: boolean;
    benchmark?: boolean;
    progress?: boolean;
    'use-queue'?: boolean;
    priority?: 'standard' | 'high';
    help?: boolean;
    version?: boolean;
    // Transformation control
    'no-deduplicate'?: boolean;
    'no-validate'?: boolean;
    'no-compress'?: boolean;
    'no-comments'?: boolean;
    'invert-allow'?: boolean;
    'remove-modifiers'?: boolean;
    'allow-ip'?: boolean;
    'convert-to-ascii'?: boolean;
    transformation?: string[];
    // Filtering
    exclude?: string[];
    'exclude-from'?: string[];
    include?: string[];
    'include-from'?: string[];
    // Networking
    timeout?: number;
    retries?: number;
    'user-agent'?: string;
}

/**
 * Simple console logger compatible with ILogger interface
 * Extended with additional consola-compatible methods
 */
class ConsoleLogger implements ILogger {
    private level: number = LOG_LEVEL_INFO; // info level by default
    private useStderr: boolean = false;

    setLevel(level: number): void {
        this.level = level;
    }

    setUseStderr(useStderr: boolean): void {
        this.useStderr = useStderr;
    }

    private emit(message: string): void {
        if (this.useStderr) {
            console.error(message);
        } else {
            console.log(message);
        }
    }

    trace(message: string): void {
        if (this.level >= LOG_LEVEL_TRACE) this.emit(`[TRACE] ${message}`);
    }

    debug(message: string): void {
        if (this.level >= LOG_LEVEL_DEBUG) this.emit(`[DEBUG] ${message}`);
    }

    info(message: string): void {
        if (this.level >= LOG_LEVEL_INFO) this.emit(`[INFO] ${message}`);
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
        if (this.level >= LOG_LEVEL_INFO) this.emit(`[SUCCESS] ${message}`);
    }

    log(message: string): void {
        this.emit(message);
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

        // Pass HTTP options when any networking flag is provided
        if (this.args.timeout !== undefined || this.args.retries !== undefined || this.args['user-agent'] !== undefined) {
            const downloaderOptions: DownloaderOptions = {};
            if (this.args.timeout !== undefined) downloaderOptions.timeout = this.args.timeout;
            if (this.args.retries !== undefined) downloaderOptions.maxRetries = this.args.retries;
            if (this.args['user-agent'] !== undefined) downloaderOptions.userAgent = this.args['user-agent'];
            options.downloaderOptions = downloaderOptions;
        }

        this.compiler = new FilterCompiler(options);
    }

    /**
     * Shows help message
     */
    private showHelp(): void {
        console.log(`
Usage: adblock-compiler [options]

General:
  -c, --config <file>          Path to the compiler configuration file
  -i, --input <source>         URL (or path to a file) to convert to an AdGuard-syntax
                               blocklist. Can be specified multiple times.
  -t, --input-type <type>      Input format: hosts|adblock [default: hosts]
  -v, --verbose                Enable verbose logging
  -b, --benchmark              Show performance benchmark report
  -p, --progress               Show real-time progress events during compilation
      --version                Show version number
  -h, --help                   Show this help

Output:
  -o, --output <file>          Path to the output file [required unless --stdout]
      --stdout                 Write output to stdout instead of a file
      --append                 Append to output file instead of overwriting
      --format <format>        Output format [not yet supported]
      --name <file>            Compare output against an existing file and print a
                               summary of added/removed rules
      --max-rules <n>          Truncate output to at most <n> rules

Transformations:
      --no-deduplicate         Skip the Deduplicate transformation
      --no-validate            Skip the Validate transformation
      --no-compress            Skip the Compress transformation
      --no-comments            Skip the RemoveComments transformation
      --invert-allow           Apply the InvertAllow transformation
      --remove-modifiers       Apply the RemoveModifiers transformation
      --allow-ip               Use ValidateAllowIp instead of Validate
      --convert-to-ascii       Apply the ConvertToAscii transformation
      --transformation <name>  Specify transformation pipeline explicitly (repeatable).
                               Overrides all other transformation flags.
                               Values: RemoveComments, Deduplicate, Compress, Validate,
                                       ValidateAllowIp, InvertAllow, RemoveModifiers,
                                       TrimLines, InsertFinalNewLine, RemoveEmptyLines,
                                       ConvertToAscii, ConflictDetection, RuleOptimizer

Filtering:
      --exclude <pattern>      Exclude rules matching pattern (repeatable)
      --exclude-from <file>    Load exclusions from file (repeatable)
      --include <pattern>      Include only rules matching pattern (repeatable)
      --include-from <file>    Load inclusions from file (repeatable)

Networking:
      --timeout <ms>           HTTP request timeout in milliseconds
      --retries <n>            Number of HTTP retry attempts
      --user-agent <string>    Custom HTTP User-Agent header

Examples:
  adblock-compiler -c config.json -o output.txt
      compile a blocklist and write the output to output.txt

  adblock-compiler -i https://example.org/hosts.txt -o output.txt
      compile a blocklist from the URL and write the output to output.txt

  adblock-compiler -i https://example.org/hosts.txt --stdout
      compile a blocklist and write rules to stdout

  adblock-compiler -i https://example.org/hosts.txt -o output.txt --no-deduplicate
      compile without deduplication

  adblock-compiler -c config.json -o output.txt --benchmark
      compile and show performance metrics
`);
    }

    /**
     * Parses command-line arguments using Deno's std/cli.
     */
    private parseArgs(argv: string[]): ICliArgs {
        const parsed = parseArgs(argv, {
            string: ['config', 'input-type', 'output', 'format', 'name', 'user-agent', 'priority'],
            boolean: [
                'verbose',
                'benchmark',
                'help',
                'version',
                'progress',
                'stdout',
                'append',
                'use-queue',
                'no-deduplicate',
                'no-validate',
                'no-compress',
                'no-comments',
                'invert-allow',
                'remove-modifiers',
                'allow-ip',
                'convert-to-ascii',
            ],
            collect: ['input', 'transformation', 'exclude', 'exclude-from', 'include', 'include-from'],
            alias: {
                c: 'config',
                i: 'input',
                t: 'input-type',
                o: 'output',
                v: 'verbose',
                b: 'benchmark',
                p: 'progress',
                q: 'use-queue',
                h: 'help',
            },
        });

        const toArr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
        const toNum = (v: unknown, flagName: string): number | undefined => {
            if (v === undefined || v === null || v === '') return undefined;
            const n = Number(v);
            if (!Number.isFinite(n) || !Number.isInteger(n)) {
                throw new Error(`Invalid value for --${flagName}: expected a finite integer, got: ${String(v)}`);
            }
            return n;
        };

        const inputArr = toArr(parsed.input);
        const transformationArr = toArr(parsed.transformation);
        const excludeArr = toArr(parsed.exclude);
        const excludeFromArr = toArr(parsed['exclude-from']);
        const includeArr = toArr(parsed.include);
        const includeFromArr = toArr(parsed['include-from']);

        return {
            config: parsed.config,
            input: inputArr.length > 0 ? inputArr : undefined,
            'input-type': parsed['input-type'],
            output: parsed.output,
            stdout: parsed.stdout,
            append: parsed.append,
            format: parsed.format,
            name: parsed.name,
            'max-rules': toNum(parsed['max-rules'], 'max-rules'),
            verbose: parsed.verbose,
            benchmark: parsed.benchmark,
            progress: parsed.progress,
            'use-queue': parsed['use-queue'],
            priority: parsed.priority as 'standard' | 'high' | undefined,
            help: parsed.help,
            version: parsed.version,
            'no-deduplicate': parsed['no-deduplicate'],
            'no-validate': parsed['no-validate'],
            'no-compress': parsed['no-compress'],
            'no-comments': parsed['no-comments'],
            'invert-allow': parsed['invert-allow'],
            'remove-modifiers': parsed['remove-modifiers'],
            'allow-ip': parsed['allow-ip'],
            'convert-to-ascii': parsed['convert-to-ascii'],
            transformation: transformationArr.length > 0 ? transformationArr : undefined,
            exclude: excludeArr.length > 0 ? excludeArr : undefined,
            'exclude-from': excludeFromArr.length > 0 ? excludeFromArr : undefined,
            include: includeArr.length > 0 ? includeArr : undefined,
            'include-from': includeFromArr.length > 0 ? includeFromArr : undefined,
            timeout: toNum(parsed.timeout, 'timeout'),
            retries: toNum(parsed.retries, 'retries'),
            'user-agent': parsed['user-agent'],
        };
    }

    /**
     * Returns true if any transformation-modifying CLI flag is present.
     */
    private hasAnyTransformationFlags(): boolean {
        return !!(
            this.args.transformation?.length ||
            this.args['no-deduplicate'] ||
            this.args['no-validate'] ||
            this.args['no-compress'] ||
            this.args['no-comments'] ||
            this.args['invert-allow'] ||
            this.args['remove-modifiers'] ||
            this.args['allow-ip'] ||
            this.args['convert-to-ascii']
        );
    }

    /**
     * Reads the configuration file using Deno's file system API.
     */
    private async readConfig(): Promise<IConfiguration> {
        this.logger.debug(`Reading configuration from ${this.args.config}`);

        try {
            const configStr = await Deno.readTextFile(this.args.config!);
            const configData = JSON.parse(configStr);

            const result = ConfigurationSchema.safeParse(configData);
            if (!result.success) {
                const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
                throw new Error(`Invalid configuration file:\n${issues}`);
            }

            const config = result.data;

            // Apply CLI transformation overrides when any transformation flag is provided
            if (this.hasAnyTransformationFlags()) {
                config.transformations = this.buildTransformations(config.transformations);
            }

            // Apply CLI filtering overlays
            if (this.args.exclude?.length) {
                config.exclusions = [...(config.exclusions ?? []), ...this.args.exclude];
            }
            if (this.args['exclude-from']?.length) {
                config.exclusions_sources = [...(config.exclusions_sources ?? []), ...this.args['exclude-from']];
            }
            if (this.args.include?.length) {
                config.inclusions = [...(config.inclusions ?? []), ...this.args.include];
            }
            if (this.args['include-from']?.length) {
                config.inclusions_sources = [...(config.inclusions_sources ?? []), ...this.args['include-from']];
            }

            return config;
        } catch (error) {
            if (error instanceof Deno.errors.NotFound) {
                throw new Error(`Configuration file not found: ${this.args.config}`);
            }
            throw error;
        }
    }

    /**
     * Builds the transformation list from CLI flags.
     *
     * When `--transformation` values are provided, they are used as-is and all other
     * transformation flags (`--no-*`, `--invert-allow`, etc.) are ignored.
     *
     * Otherwise the `existingTransformations` list (or the built-in default pipeline) is
     * used as a starting point and modified by the boolean flags:
     * - `--no-comments`   removes `RemoveComments`
     * - `--no-deduplicate` removes `Deduplicate`
     * - `--no-compress`   removes `Compress`
     * - `--no-validate`   removes `Validate`
     * - `--allow-ip`      removes `Validate` and adds `ValidateAllowIp`
     * - `--invert-allow`  appends `InvertAllow`
     * - `--remove-modifiers` appends `RemoveModifiers`
     * - `--convert-to-ascii` appends `ConvertToAscii`
     *
     * @param existingTransformations - Optional list from a config file to use as the base.
     *   When omitted the default pipeline is used.
     * @returns Resolved transformation list.
     */
    private buildTransformations(existingTransformations?: TransformationType[]): TransformationType[] {
        // Explicit pipeline overrides everything
        if (this.args.transformation && this.args.transformation.length > 0) {
            const validValues = new Set(Object.values(TransformationType) as string[]);
            const invalid = this.args.transformation.filter((name) => !validValues.has(name));
            if (invalid.length > 0) {
                throw new Error(
                    `Unknown transformation value(s): ${invalid.join(', ')}. Valid values are: ${[...validValues].join(', ')}`,
                );
            }
            return this.args.transformation as TransformationType[];
        }

        // Start from the provided list or the default list
        let transformations: TransformationType[] = existingTransformations ? [...existingTransformations] : [
            TransformationType.RemoveComments,
            TransformationType.Deduplicate,
            TransformationType.Compress,
            TransformationType.Validate,
            TransformationType.TrimLines,
            TransformationType.InsertFinalNewLine,
        ];

        // Apply removal flags
        if (this.args['no-comments']) {
            transformations = transformations.filter((t) => t !== TransformationType.RemoveComments);
        }
        if (this.args['no-deduplicate']) {
            transformations = transformations.filter((t) => t !== TransformationType.Deduplicate);
        }
        if (this.args['no-compress']) {
            transformations = transformations.filter((t) => t !== TransformationType.Compress);
        }
        if (this.args['no-validate'] || this.args['allow-ip']) {
            transformations = transformations.filter((t) => t !== TransformationType.Validate);
        }

        // Apply addition flags
        if (this.args['allow-ip'] && !transformations.includes(TransformationType.ValidateAllowIp)) {
            transformations.push(TransformationType.ValidateAllowIp);
        }
        if (this.args['invert-allow'] && !transformations.includes(TransformationType.InvertAllow)) {
            transformations.push(TransformationType.InvertAllow);
        }
        if (this.args['remove-modifiers'] && !transformations.includes(TransformationType.RemoveModifiers)) {
            transformations.push(TransformationType.RemoveModifiers);
        }
        if (this.args['convert-to-ascii'] && !transformations.includes(TransformationType.ConvertToAscii)) {
            transformations.push(TransformationType.ConvertToAscii);
        }

        return transformations;
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

        const transformations = this.buildTransformations();

        const config: IConfiguration = {
            name: 'Blocklist',
            sources,
            transformations,
            ...(this.args.exclude?.length && { exclusions: this.args.exclude }),
            ...(this.args['exclude-from']?.length && { exclusions_sources: this.args['exclude-from'] }),
            ...(this.args.include?.length && { inclusions: this.args.include }),
            ...(this.args['include-from']?.length && { inclusions_sources: this.args['include-from'] }),
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

            // When writing rules to stdout, route all log/info output to stderr so that
            // the rule stream is clean and pipeable without interleaving log messages.
            if (this.args.stdout && this.logger instanceof ConsoleLogger) {
                this.logger.setUseStderr(true);
            }

            // Set verbose logging
            if (this.args.verbose && this.logger instanceof ConsoleLogger) {
                this.logger.setLevel(LOG_LEVEL_TRACE);
            }

            // Warn about flags that are parsed but not yet fully implemented
            if (this.args.format) {
                this.logger.warn('--format is not yet supported and will be ignored');
            }

            if (this.args['use-queue']) {
                this.logger.warn('--use-queue is only supported via the worker API and will be ignored in standalone CLI mode');
            }

            if (this.args.priority) {
                this.logger.warn('--priority is only supported via the worker API and will be ignored in standalone CLI mode');
            }

            this.logger.info(`Starting @jk-com/adblock-compiler v${VERSION}`);

            // Validate required arguments
            if (!this.args.input && !this.args.config) {
                throw new Error('Either --input or --config must be specified');
            }

            if (!this.args.output && !this.args.stdout) {
                throw new Error('--output is required (or use --stdout)');
            }

            if (this.args.output && this.args.stdout) {
                throw new Error('Cannot specify both --output and --stdout');
            }

            // Initialize compiler with optional event handlers
            this.initCompiler();

            // Get configuration
            const config = this.args.input ? this.createConfig() : await this.readConfig();

            this.logger.debug(`Configuration: ${JSON.stringify(config, null, 4)}`);

            // Compile with optional benchmarking
            const result = await this.compiler.compileWithMetrics(config, this.args.benchmark || false);

            // Apply max-rules limit
            let outputRules = result.rules;
            const maxRules = this.args['max-rules'];
            if (maxRules !== undefined && outputRules.length > maxRules) {
                this.logger.warn(`Rule count ${outputRules.length} exceeds --max-rules ${maxRules}, truncating`);
                outputRules = outputRules.slice(0, maxRules);
            }

            // Print comparison summary if --name was provided.
            // Route to stderr when in --stdout mode so the rule stream is not contaminated.
            if (this.args.name) {
                const printSummary = this.args.stdout ? console.error : console.log;
                try {
                    const existingContent = await Deno.readTextFile(this.args.name);
                    const existingRulesSet = new Set(existingContent.split('\n').filter((r) => r.trim() !== ''));
                    const newRulesSet = new Set(outputRules);
                    let added = 0;
                    let removed = 0;
                    for (const rule of newRulesSet) {
                        if (!existingRulesSet.has(rule)) added++;
                    }
                    for (const rule of existingRulesSet) {
                        if (!newRulesSet.has(rule)) removed++;
                    }
                    printSummary(`\nComparison with ${this.args.name}:`);
                    printSummary(`  Added:   +${added} rules`);
                    printSummary(`  Removed: -${removed} rules`);
                    printSummary(`  Net:     ${added - removed >= 0 ? '+' : ''}${added - removed} rules`);
                } catch {
                    this.logger.warn(`Could not read comparison file: ${this.args.name}`);
                }
            }

            // Write output
            if (this.args.stdout) {
                await Deno.stdout.write(new TextEncoder().encode(outputRules.join('\n') + '\n'));
                this.logger.info('Finished compiling (output written to stdout)');
            } else {
                this.logger.info(`Writing output to ${this.args.output}`);
                await Deno.writeTextFile(
                    this.args.output!,
                    outputRules.join('\n'),
                    this.args.append ? { append: true } : undefined,
                );
                this.logger.info('Finished compiling');
            }
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
