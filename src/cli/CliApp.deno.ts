#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net

import { parseArgs } from '@std/flags';
import { IConfiguration, ILogger, ISource, SourceType, TransformationType } from '../types/index.ts';
import { FilterCompiler } from '../compiler/index.ts';

// Read package version from deno.json
const denoConfig = JSON.parse(await Deno.readTextFile('./deno.json'));
const VERSION = denoConfig.version;

/**
 * CLI arguments interface
 */
interface ICliArgs {
    config?: string;
    input?: string[];
    'input-type'?: string;
    output?: string;
    verbose?: boolean;
    help?: boolean;
    version?: boolean;
}

/**
 * Simple console logger compatible with consola interface
 */
class ConsoleLogger implements ILogger {
    private level: number = 3; // info level by default

    setLevel(level: number): void {
        this.level = level;
    }

    trace(...args: unknown[]): void {
        if (this.level >= 5) console.log('[TRACE]', ...args);
    }

    debug(...args: unknown[]): void {
        if (this.level >= 4) console.log('[DEBUG]', ...args);
    }

    info(...args: unknown[]): void {
        if (this.level >= 3) console.log('[INFO]', ...args);
    }

    warn(...args: unknown[]): void {
        if (this.level >= 2) console.warn('[WARN]', ...args);
    }

    error(...args: unknown[]): void {
        if (this.level >= 1) console.error('[ERROR]', ...args);
    }

    fatal(...args: unknown[]): void {
        console.error('[FATAL]', ...args);
    }

    success(...args: unknown[]): void {
        if (this.level >= 3) console.log('[SUCCESS]', ...args);
    }

    log(...args: unknown[]): void {
        console.log(...args);
    }
}

/**
 * Command-line interface application for the hostlist compiler.
 */
export class CliApp {
    private readonly logger: ILogger;
    private readonly compiler: FilterCompiler;
    private args!: ICliArgs;

    constructor(logger?: ILogger) {
        this.logger = logger || new ConsoleLogger();
        this.compiler = new FilterCompiler(this.logger);
    }

    /**
     * Shows help message
     */
    private showHelp(): void {
        console.log(`
Usage: hostlist-compiler [options]

Options:
  -c, --config <file>      Path to the compiler configuration file
  -i, --input <source>     URL (or path to a file) to convert to an AdGuard-syntax
                           blocklist. Can be specified multiple times.
  -t, --input-type <type>  Type of the input file (hosts|adblock) [default: hosts]
  -o, --output <file>      Path to the output file [required]
  -v, --verbose            Run with verbose logging
  --version                Show version number
  -h, --help               Show help

Examples:
  hostlist-compiler -c config.json -o output.txt
      compile a blocklist and write the output to output.txt

  hostlist-compiler -i https://example.org/hosts.txt -o output.txt
      compile a blocklist from the URL and write the output to output.txt
`);
    }

    /**
     * Parses command-line arguments using Deno's std/flags.
     */
    private parseArgs(argv: string[]): ICliArgs {
        const parsed = parseArgs(argv, {
            string: ['config', 'input-type', 'output'],
            boolean: ['verbose', 'help', 'version'],
            collect: ['input'],
            alias: {
                c: 'config',
                i: 'input',
                t: 'input-type',
                o: 'output',
                v: 'verbose',
                h: 'help',
            },
        });

        return {
            config: parsed.config,
            input: parsed.input,
            'input-type': parsed['input-type'],
            output: parsed.output,
            verbose: parsed.verbose,
            help: parsed.help,
            version: parsed.version,
        };
    }

    /**
     * Reads the configuration file using Deno's file system API.
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
                this.logger.setLevel(5); // trace level
            }

            this.logger.info(`Starting @adguard/hostlist-compiler v${VERSION}`);

            // Validate required arguments
            if (!this.args.input && !this.args.config) {
                throw new Error('Either --input or --config must be specified');
            }

            if (!this.args.output) {
                throw new Error('--output is required');
            }

            // Get configuration
            const config = this.args.input
                ? this.createConfig()
                : await this.readConfig();

            this.logger.debug(`Configuration: ${JSON.stringify(config, null, 4)}`);

            // Compile
            const lines = await this.compiler.compile(config);

            // Write output using Deno's file system API
            this.logger.info(`Writing output to ${this.args.output}`);
            await Deno.writeTextFile(this.args.output, lines.join('\n'));
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
