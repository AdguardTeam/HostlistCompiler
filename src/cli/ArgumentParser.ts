// deno-lint-ignore-file no-console
import { parse } from '@std/flags';

/**
 * Parsed CLI arguments
 */
export interface ParsedArguments {
    config?: string;
    input?: string[];
    inputType?: string;
    output?: string;
    verbose?: boolean;
    benchmark?: boolean;
    useQueue?: boolean;
    priority?: 'standard' | 'high';
    help?: boolean;
    version?: boolean;
}

/**
 * Parses command-line arguments for the hostlist compiler.
 * Follows Single Responsibility Principle - only handles argument parsing.
 */
export class ArgumentParser {
    /**
     * Parses command-line arguments
     * @param argv - Array of command-line arguments (from Deno.args)
     * @returns Parsed arguments object
     */
    public parse(argv: string[]): ParsedArguments {
        const parsed = parse(argv, {
            string: ['config', 'input-type', 'output', 'priority'],
            boolean: ['verbose', 'benchmark', 'use-queue', 'help', 'version'],
            collect: ['input'],
            alias: {
                c: 'config',
                i: 'input',
                t: 'input-type',
                o: 'output',
                v: 'verbose',
                b: 'benchmark',
                q: 'use-queue',
                h: 'help',
            },
        });

        return {
            config: parsed.config as string | undefined,
            input: parsed.input as string[] | undefined,
            inputType: parsed['input-type'] as string | undefined,
            output: parsed.output as string | undefined,
            verbose: parsed.verbose as boolean | undefined,
            benchmark: parsed.benchmark as boolean | undefined,
            useQueue: parsed['use-queue'] as boolean | undefined,
            priority: parsed.priority as 'standard' | 'high' | undefined,
            help: parsed.help as boolean | undefined,
            version: parsed.version as boolean | undefined,
        };
    }

    /**
     * Validates that required arguments are present
     * @param args - Parsed arguments
     * @returns Error message if invalid, null if valid
     */
    public validate(args: ParsedArguments): string | null {
        // Help and version don't require other arguments
        if (args.help || args.version) {
            return null;
        }

        // Output is always required
        if (!args.output) {
            return 'Output file path is required (use -o or --output)';
        }

        // Either config or input must be provided
        if (!args.config && (!args.input || args.input.length === 0)) {
            return 'Either config file (-c) or input sources (-i) must be provided';
        }

        // Cannot specify both config and input
        if (args.config && args.input && args.input.length > 0) {
            return 'Cannot specify both config file (-c) and input sources (-i)';
        }

        return null;
    }

    /**
     * Displays help message
     */
    public showHelp(): void {
        console.log(`
Usage: hostlist-compiler [options]

Options:
  -c, --config <file>      Path to the compiler configuration file
  -i, --input <source>     URL (or path to a file) to convert to an AdGuard-syntax
                           blocklist. Can be specified multiple times.
  -t, --input-type <type>  Type of the input file (hosts|adblock) [default: hosts]
  -o, --output <file>      Path to the output file [required]
  -v, --verbose            Run with verbose logging
  -b, --benchmark          Show performance benchmark report
  -q, --use-queue          Use asynchronous queue-based compilation (requires worker API)
  --priority <level>       Queue priority level: standard|high [default: standard]
                           Only applies when --use-queue is enabled
  --version                Show version number
  -h, --help               Show help

Examples:
  hostlist-compiler -c config.json -o output.txt
      compile a blocklist and write the output to output.txt

  hostlist-compiler -i https://example.org/hosts.txt -o output.txt
      compile a blocklist from the URL and write the output to output.txt

  hostlist-compiler -c config.json -o output.txt --benchmark
      compile and show performance metrics

  hostlist-compiler -c config.json -o output.txt --use-queue --priority high
      queue a compilation job with high priority (async processing)
`);
    }

    /**
     * Displays version information
     * @param version - Version string to display
     */
    public showVersion(version: string): void {
        console.log(`hostlist-compiler ${version}`);
    }
}
