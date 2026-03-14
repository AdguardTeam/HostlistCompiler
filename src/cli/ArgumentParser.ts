// deno-lint-ignore-file no-console
import { parseArgs } from '@std/cli/parse-args';
import { CliArgumentsSchema } from '../configuration/schemas.ts';

/**
 * Parsed CLI arguments
 */
export interface ParsedArguments {
    config?: string;
    input?: string[];
    inputType?: string;
    output?: string;
    stdout?: boolean;
    append?: boolean;
    format?: string;
    name?: string;
    maxRules?: number;
    verbose?: boolean;
    benchmark?: boolean;
    useQueue?: boolean;
    priority?: 'standard' | 'high';
    help?: boolean;
    version?: boolean;
    // Transformation control
    noDeduplicate?: boolean;
    noValidate?: boolean;
    noCompress?: boolean;
    noComments?: boolean;
    invertAllow?: boolean;
    removeModifiers?: boolean;
    allowIp?: boolean;
    convertToAscii?: boolean;
    transformation?: string[];
    // Filtering
    exclude?: string[];
    excludeFrom?: string[];
    include?: string[];
    includeFrom?: string[];
    // Networking
    timeout?: number;
    retries?: number;
    userAgent?: string;
    // Authentication (for remote API calls via --use-queue)
    apiKey?: string;
    bearerToken?: string;
    apiUrl?: string;
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
        const parsed = parseArgs(argv, {
            string: ['config', 'input-type', 'output', 'priority', 'format', 'name', 'user-agent', 'api-key', 'bearer-token', 'api-url'],
            boolean: [
                'verbose',
                'benchmark',
                'use-queue',
                'help',
                'version',
                'stdout',
                'append',
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
            if (n < 0) {
                throw new Error(`Invalid value for --${flagName}: expected a non-negative integer, got: ${n}`);
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
            config: parsed.config as string | undefined,
            input: inputArr.length > 0 ? inputArr : undefined,
            inputType: parsed['input-type'] as string | undefined,
            output: parsed.output as string | undefined,
            stdout: parsed.stdout as boolean | undefined,
            append: parsed.append as boolean | undefined,
            format: parsed.format as string | undefined,
            name: parsed.name as string | undefined,
            maxRules: toNum(parsed['max-rules'], 'max-rules'),
            verbose: parsed.verbose as boolean | undefined,
            benchmark: parsed.benchmark as boolean | undefined,
            useQueue: parsed['use-queue'] as boolean | undefined,
            priority: parsed.priority as 'standard' | 'high' | undefined,
            help: parsed.help as boolean | undefined,
            version: parsed.version as boolean | undefined,
            noDeduplicate: parsed['no-deduplicate'] as boolean | undefined,
            noValidate: parsed['no-validate'] as boolean | undefined,
            noCompress: parsed['no-compress'] as boolean | undefined,
            noComments: parsed['no-comments'] as boolean | undefined,
            invertAllow: parsed['invert-allow'] as boolean | undefined,
            removeModifiers: parsed['remove-modifiers'] as boolean | undefined,
            allowIp: parsed['allow-ip'] as boolean | undefined,
            convertToAscii: parsed['convert-to-ascii'] as boolean | undefined,
            transformation: transformationArr.length > 0 ? transformationArr : undefined,
            exclude: excludeArr.length > 0 ? excludeArr : undefined,
            excludeFrom: excludeFromArr.length > 0 ? excludeFromArr : undefined,
            include: includeArr.length > 0 ? includeArr : undefined,
            includeFrom: includeFromArr.length > 0 ? includeFromArr : undefined,
            timeout: toNum(parsed.timeout, 'timeout'),
            retries: toNum(parsed.retries, 'retries'),
            userAgent: parsed['user-agent'] as string | undefined,
            apiKey: parsed['api-key'] as string | undefined,
            bearerToken: parsed['bearer-token'] as string | undefined,
            apiUrl: (parsed['api-url'] as string | undefined) ?? 'http://localhost:8787',
        };
    }

    /**
     * Validates that required arguments are present
     * @param args - Parsed arguments
     * @returns Error message if invalid, null if valid
     */
    public validate(args: ParsedArguments): string | null {
        const result = CliArgumentsSchema.safeParse(args);
        if (!result.success) {
            return result.error.issues.map((i) => i.message).join('; ');
        }
        return null;
    }

    /**
     * Displays help message
     */
    public showHelp(): void {
        console.log(`
Usage: adblock-compiler [options]

General:
  -c, --config <file>          Path to the compiler configuration file
  -i, --input <source>         URL (or path to a file) to convert to an AdGuard-syntax
                               blocklist. Can be specified multiple times.
  -t, --input-type <type>      Input format: hosts|adblock [default: hosts]
  -v, --verbose                Enable verbose logging
  -b, --benchmark              Show performance benchmark report
  -q, --use-queue              Use asynchronous queue-based compilation (requires worker API)
      --priority <level>       Queue priority: standard|high [default: standard]
                               Only applies when --use-queue is enabled
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

Authentication:
      --api-key <key>          API key for authenticated worker API requests (abc_ prefix)
      --bearer-token <token>   Clerk JWT bearer token for authenticated requests
      --api-url <url>          Base URL for the worker API [default: http://localhost:8787]
                               Used with --use-queue for remote compilation

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

  adblock-compiler -c config.json -o output.txt --use-queue --priority high
      queue a compilation job with high priority (async processing)

  adblock-compiler -c config.json -o output.txt --use-queue --api-key abc_mykey123
      queue a compilation using API key authentication

  adblock-compiler -c config.json -o output.txt --use-queue --bearer-token eyJhbG...
      queue a compilation using Clerk JWT bearer token
`);
    }

    /**
     * Displays version information
     * @param version - Version string to display
     */
    public showVersion(version: string): void {
        console.log(`adblock-compiler ${version}`);
    }
}
