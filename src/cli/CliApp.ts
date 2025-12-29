import * as fs from 'fs/promises';
import consola from 'consola';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { IConfiguration, ILogger, ISource, SourceType, TransformationType } from '../types';
import { FilterCompiler } from '../compiler';
import packageJson from '../../package.json';

/**
 * CLI arguments interface
 */
interface ICliArgs {
    config?: string;
    input?: string[];
    'input-type'?: string;
    output: string;
    verbose?: boolean;
}

/**
 * Command-line interface application for the hostlist compiler.
 */
export class CliApp {
    private readonly logger: ILogger;
    private readonly compiler: FilterCompiler;
    private args!: ICliArgs;

    constructor(logger?: ILogger) {
        this.logger = logger || consola;
        this.compiler = new FilterCompiler(this.logger);
    }

    /**
     * Parses command-line arguments.
     */
    private parseArgs(argv: string[]): ICliArgs {
        return yargs(hideBin(argv))
            .usage('Usage: $0 [options]')
            .example(
                '$0 -c config.json -o output.txt',
                'compile a blocklist and write the output to output.txt',
            )
            .example(
                '$0 -i https://example.org/hosts.txt -o output.txt',
                'compile a blocklist from the URL and write the output to output.txt',
            )
            .option('config', {
                alias: 'c',
                type: 'string',
                description: 'Path to the compiler configuration file',
                nargs: 1,
            })
            .option('input', {
                alias: 'i',
                array: true,
                type: 'string',
                description: 'URL (or path to a file) to convert to an AdGuard-syntax blocklist. Can be specified multiple times.',
            })
            .option('input-type', {
                alias: 't',
                type: 'string',
                description: 'Type of the input file (/etc/hosts, adguard)',
                nargs: 1,
            })
            .option('output', {
                alias: 'o',
                type: 'string',
                description: 'Path to the output file',
                nargs: 1,
                demandOption: true,
            })
            .option('verbose', {
                alias: 'v',
                type: 'boolean',
                description: 'Run with verbose logging',
            })
            .version(packageJson.version)
            .help('h')
            .alias('h', 'help')
            .parseSync() as ICliArgs;
    }

    /**
     * Reads the configuration file.
     */
    private async readConfig(): Promise<IConfiguration> {
        this.logger.debug(`Reading configuration from ${this.args.config}`);

        await fs.access(this.args.config!);
        const configStr = (await fs.readFile(this.args.config!)).toString();

        return JSON.parse(configStr) as IConfiguration;
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

            if (this.args.verbose) {
                consola.level = 5; // trace level
            }

            this.logger.info(`Starting ${packageJson.name} v${packageJson.version}`);

            if (!this.args.input && !this.args.config) {
                throw new Error('Either --input or --config must be specified');
            }

            const config = this.args.input
                ? this.createConfig()
                : await this.readConfig();

            this.logger.debug(`Configuration: ${JSON.stringify(config, null, 4)}`);

            const lines = await this.compiler.compile(config);

            this.logger.info(`Writing output to ${this.args.output}`);
            await fs.writeFile(this.args.output, lines.join('\n'));
            this.logger.info('Finished compiling');
        } catch (error) {
            this.logger.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    }
}

/**
 * Main entry point for CLI.
 */
export async function main(): Promise<void> {
    const app = new CliApp();
    await app.run(process.argv);
}
