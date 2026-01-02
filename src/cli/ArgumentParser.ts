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
            config: parsed.config as string | undefined,
            input: parsed.input as string[] | undefined,
            inputType: parsed['input-type'] as string | undefined,
            output: parsed.output as string | undefined,
            verbose: parsed.verbose as boolean | undefined,
            benchmark: parsed.benchmark as boolean | undefined,
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
        // deno-lint-ignore no-console
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
  --version                Show version number
  -h, --help               Show help

Examples:
  hostlist-compiler -c config.json -o output.txt
      compile a blocklist and write the output to output.txt

  hostlist-compiler -i https://example.org/hosts.txt -o output.txt
      compile a blocklist from the URL and write the output to output.txt

  hostlist-compiler -c config.json -o output.txt --benchmark
      compile and show performance metrics
`);
    }

    /**
     * Displays version information
     * @param version - Version string to display
     */
    public showVersion(version: string): void {
        // deno-lint-ignore no-console
        console.log(`hostlist-compiler ${version}`);
    }
}
