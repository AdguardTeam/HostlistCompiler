/**
 * Zod schemas for runtime validation with TypeScript integration.
 * Provides type-safe validation for configuration objects.
 */

import { z } from 'zod';
import { type IConfiguration, type ISource, type LogLevelType, SourceType, TransformationType } from '../types/index.ts';

// ============================================================================
// Public enums and constants (declared early for reuse throughout this file)
// ============================================================================

/**
 * Schema for request/job priority level.
 * Shared between CompileRequestSchema, BatchRequestSchema, CliArgumentsSchema, and worker schemas.
 */
export const PrioritySchema: z.ZodEnum<{ standard: 'standard'; high: 'high' }> = z.enum(['standard', 'high']).describe('Request processing priority level');
export type Priority = z.infer<typeof PrioritySchema>;

// ============================================================================
// Output types for schemas without matching public interfaces
// ============================================================================

type CompileRequestOutput = {
    configuration: IConfiguration;
    preFetchedContent?: Record<string, string>;
    benchmark?: boolean;
    priority?: z.infer<typeof PrioritySchema>;
    turnstileToken?: string;
};

type BatchRequestItem = {
    id: string;
    configuration: IConfiguration;
    preFetchedContent?: Record<string, string>;
    benchmark?: boolean;
};

type BatchRequestOutput = {
    requests: BatchRequestItem[];
    priority?: z.infer<typeof PrioritySchema>;
};

type HttpFetcherOptionsOutput = {
    timeout?: number;
    userAgent?: string;
    allowEmptyResponse?: boolean;
    headers?: Record<string, string>;
};

type PlatformCompilerOptionsOutput = {
    preFetchedContent?: Map<string, string> | Record<string, string>;
    httpOptions?: HttpFetcherOptionsOutput;
    [key: string]: unknown;
};

type ValidationErrorType =
    | 'parse_error'
    | 'syntax_error'
    | 'unsupported_modifier'
    | 'invalid_hostname'
    | 'ip_not_allowed'
    | 'pattern_too_short'
    | 'public_suffix_match'
    | 'invalid_characters'
    | 'cosmetic_not_supported'
    | 'modifier_validation_failed';

type ValidationSeverity = 'error' | 'warning' | 'info';

type ValidationErrorOutput = {
    type: ValidationErrorType;
    severity: ValidationSeverity;
    ruleText: string;
    lineNumber?: number;
    message: string;
    details?: string;
    ast?: unknown;
    sourceName?: string;
};

type ValidationReportOutput = {
    errorCount: number;
    warningCount: number;
    infoCount: number;
    errors: ValidationErrorOutput[];
    totalRules: number;
    validRules: number;
    invalidRules: number;
};

type ValidationResultOutput = {
    rules: string[];
    validation: ValidationReportOutput;
};

// ============================================================================
// Private helper schemas
// ============================================================================

/**
 * Schema for filterable properties (exclusions/inclusions)
 */
const FilterableSchema: z.ZodObject<{
    exclusions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    exclusions_sources: z.ZodOptional<z.ZodArray<z.ZodString>>;
    inclusions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    inclusions_sources: z.ZodOptional<z.ZodArray<z.ZodString>>;
}> = z.object({
    exclusions: z.array(z.string()).optional(),
    exclusions_sources: z.array(z.string()).optional(),
    inclusions: z.array(z.string()).optional(),
    inclusions_sources: z.array(z.string()).optional(),
});

/**
 * Schema for transformable properties
 */
const TransformableSchema: z.ZodObject<{
    transformations: z.ZodOptional<z.ZodArray<z.ZodEnum<typeof TransformationType>>>;
}> = z.object({
    transformations: z.array(z.nativeEnum(TransformationType)).optional(),
});

/**
 * Schema for source type validation
 */
const SourceTypeSchema: z.ZodEnum<typeof SourceType> = z.nativeEnum(SourceType);

/**
 * Reusable schema for preFetchedContent fields.
 * Keys are arbitrary source identifiers mapped to their pre-fetched content.
 */
const PreFetchedContentSchema = z.record(z.string(), z.string()).optional();

/**
 * Validates that when Compress is used, Deduplicate is present and appears before it
 */
function hasValidTransformationOrdering(data: { transformations?: TransformationType[] }): boolean {
    const t = data.transformations;
    if (!t) return true;

    const compressIndex = t.indexOf(TransformationType.Compress);

    // If Compress is not used, no ordering constraint applies
    if (compressIndex === -1) return true;

    const deduplicateIndex = t.indexOf(TransformationType.Deduplicate);

    // Compress requires Deduplicate, and Deduplicate must come before Compress
    if (deduplicateIndex === -1) return false;

    return deduplicateIndex < compressIndex;
}

const transformationOrderingMessage = {
    message: 'Deduplicate transformation is recommended before Compress. Add Deduplicate before Compress in transformations.',
    path: ['transformations'] as string[],
};

// ============================================================================
// Public schemas
// ============================================================================

/**
 * Schema for ISource validation
 */
export const SourceSchema: z.ZodType<ISource> = z.object({
    source: z.string().trim().min(1, 'source is required and must be a non-empty string').refine(
        (val) => {
            try {
                new URL(val);
                return true;
            } catch { /* not a URL */ }
            return val.startsWith('/') || /^\.\.?\//.test(val);
        },
        { message: 'source must be a valid URL or file path' },
    ).describe('URL or file path to the filter list source'),
    name: z.string().trim().min(1, 'name must be a non-empty string').optional().describe('Human-readable name for the source'),
    type: SourceTypeSchema.optional().describe('Source format type'),
    useBrowser: z.boolean().optional().describe('When true, fetch via Cloudflare Browser Rendering instead of plain HTTP (WorkerCompiler only)'),
}).merge(FilterableSchema).merge(TransformableSchema).strict()
    .refine(hasValidTransformationOrdering, transformationOrderingMessage)
    .transform((data) => ({
        ...data,
        source: data.source.trim(),
        ...(data.name !== undefined && { name: data.name.trim() }),
    }));

/**
 * Schema for IConfiguration validation
 */
export const ConfigurationSchema: z.ZodType<IConfiguration> = z.object({
    name: z.string().min(1, 'name is required and must be a non-empty string').describe('Filter list name'),
    description: z.string().optional().describe('Human-readable description of the filter list'),
    homepage: z.string().url('homepage must be a valid URL').optional().describe('Homepage URL for the filter list'),
    license: z.string().optional().describe('License identifier (e.g. GPL-3.0, MIT)'),
    version: z.string().regex(/^\d+\.\d+(\.\d+)?/, 'version must follow semver format (e.g. 1.0.0)').optional().describe('Version string following semver format (e.g. 1.0.0)'),
    sources: z.array(SourceSchema).nonempty('sources is required and must be a non-empty array').describe('Array of source configurations (must not be empty)'),
}).merge(FilterableSchema).merge(TransformableSchema).strict()
    .refine(hasValidTransformationOrdering, transformationOrderingMessage);

/**
 * Schema for CompileRequest validation (worker)
 */
export const CompileRequestSchema: z.ZodType<CompileRequestOutput> = z.object({
    configuration: ConfigurationSchema,
    preFetchedContent: PreFetchedContentSchema,
    benchmark: z.boolean().optional().describe('Whether to collect benchmark metrics during compilation'),
    priority: PrioritySchema.optional().describe('Request processing priority level'),
    turnstileToken: z.string().optional().describe('Cloudflare Turnstile verification token'),
});

/**
 * Schema for BatchRequest validation (worker)
 */
export const BatchRequestSchema: z.ZodType<BatchRequestOutput> = z.object({
    requests: z.array(
        z.object({
            id: z.string().min(1, 'id is required and must be a non-empty string').describe('Unique identifier for the batch request item'),
            configuration: ConfigurationSchema,
            preFetchedContent: PreFetchedContentSchema,
            benchmark: z.boolean().optional().describe('Whether to collect benchmark metrics for this item'),
        }),
    ).nonempty('requests array must not be empty').describe('Array of compilation request items'),
    priority: PrioritySchema.optional().describe('Batch processing priority level'),
}).refine(
    (data) => {
        // Check for duplicate IDs
        const ids = new Set<string>();
        for (const req of data.requests) {
            if (ids.has(req.id)) {
                return false;
            }
            ids.add(req.id);
        }
        return true;
    },
    {
        message: 'Duplicate request IDs are not allowed',
        path: ['requests'],
    },
);

/**
 * Schema for sync batch requests (max 10 items)
 */
export const BatchRequestSyncSchema: z.ZodType<BatchRequestOutput> = BatchRequestSchema.refine(
    (data) => data.requests.length <= 10,
    {
        message: 'Batch request limited to 10 requests maximum',
        path: ['requests'],
    },
);

/**
 * Schema for async batch requests (max 100 items)
 */
export const BatchRequestAsyncSchema: z.ZodType<BatchRequestOutput> = BatchRequestSchema.refine(
    (data) => data.requests.length <= 100,
    {
        message: 'Batch request limited to 100 requests maximum',
        path: ['requests'],
    },
);

// ============================================================================
// Platform Type Schemas
// ============================================================================

/**
 * Schema for HTTP fetcher options
 */
export const HttpFetcherOptionsSchema: z.ZodType<HttpFetcherOptionsOutput> = z.object({
    timeout: z.number().int().positive().optional(),
    userAgent: z.string().optional(),
    allowEmptyResponse: z.boolean().optional(),
    headers: z.record(z.string(), z.string()).optional(),
});

/**
 * Schema for platform compiler options
 * Note: preFetchedContent and customFetcher are not validated as they are runtime objects
 */
export const PlatformCompilerOptionsSchema: z.ZodType<PlatformCompilerOptionsOutput> = z.object({
    preFetchedContent: z.union([
        z.map(z.string(), z.string()),
        z.record(z.string(), z.string()),
    ]).optional(),
    httpOptions: HttpFetcherOptionsSchema.optional(),
}).passthrough(); // Allow customFetcher which is not serializable

// ============================================================================
// Validation Error Schemas
// ============================================================================

/**
 * Schema for validation error type enum
 */
export const ValidationErrorTypeSchema: z.ZodType<ValidationErrorType> = z.enum([
    'parse_error',
    'syntax_error',
    'unsupported_modifier',
    'invalid_hostname',
    'ip_not_allowed',
    'pattern_too_short',
    'public_suffix_match',
    'invalid_characters',
    'cosmetic_not_supported',
    'modifier_validation_failed',
]);

/**
 * Schema for validation severity enum
 */
export const ValidationSeveritySchema: z.ZodType<ValidationSeverity> = z.enum([
    'error',
    'warning',
    'info',
]);

/**
 * Schema for a single validation error
 */
export const ValidationErrorSchema: z.ZodType<ValidationErrorOutput> = z.object({
    type: ValidationErrorTypeSchema,
    severity: ValidationSeveritySchema,
    ruleText: z.string(),
    lineNumber: z.number().int().min(1).optional(), // Line numbers are 1-based
    message: z.string(),
    details: z.string().optional(),
    ast: z.unknown().optional(), // AST node - not validated as it's complex
    sourceName: z.string().optional(),
});

/**
 * Schema for validation report
 */
export const ValidationReportSchema: z.ZodType<ValidationReportOutput> = z.object({
    errorCount: z.number().int().nonnegative(),
    warningCount: z.number().int().nonnegative(),
    infoCount: z.number().int().nonnegative(),
    errors: z.array(ValidationErrorSchema),
    totalRules: z.number().int().nonnegative(),
    validRules: z.number().int().nonnegative(),
    invalidRules: z.number().int().nonnegative(),
});

/**
 * Schema for validation result (compilation result with validation report)
 */
export const ValidationResultSchema: z.ZodType<ValidationResultOutput> = z.object({
    rules: z.array(z.string()),
    validation: ValidationReportSchema,
});

// ============================================================================
// Compilation Output Schemas
// ============================================================================

type CompilationResultBaseOutput = {
    rules: string[];
    ruleCount: number;
};

type BenchmarkMetricsOutput = {
    totalDurationMs: number;
    stages: {
        name: string;
        durationMs: number;
        itemCount?: number;
        itemsPerSecond?: number;
    }[];
    sourceCount: number;
    ruleCount: number;
    outputRuleCount: number;
};

export type WorkerCompilationResultOutput = CompilationResultBaseOutput & {
    metrics?: BenchmarkMetricsOutput;
};

type CliArgumentsOutput = {
    config?: string;
    input?: string[];
    inputType?: 'adblock' | 'hosts';
    output?: string;
    stdout?: boolean;
    append?: boolean;
    format?: string;
    name?: string;
    maxRules?: number;
    verbose?: boolean;
    benchmark?: boolean;
    useQueue?: boolean;
    priority?: Priority;
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
    transformation?: TransformationType[];
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
};

type EnvironmentOutput = {
    TURNSTILE_SECRET_KEY?: string;
    RATE_LIMIT_MAX_REQUESTS?: number;
    RATE_LIMIT_WINDOW_MS?: number;
    CACHE_TTL?: number;
    LOG_LEVEL?: LogLevelType;
    [key: string]: unknown;
};

type AdblockRuleOutput = {
    ruleText: string;
    pattern: string;
    whitelist: boolean;
    options: { name: string; value: string | null }[] | null;
    hostname: string | null;
};

type EtcHostsRuleOutput = {
    ruleText: string;
    hostnames: string[];
};

/**
 * Base compilation result object schema (used internally for extension)
 */
const compilationResultBase: z.ZodObject<{
    rules: z.ZodArray<z.ZodString>;
    ruleCount: z.ZodNumber;
}> = z.object({
    rules: z.array(z.string()),
    ruleCount: z.number().int().nonnegative(),
});

/**
 * Schema for compilation result output
 */
export const CompilationResultSchema: z.ZodType<CompilationResultBaseOutput> = compilationResultBase;
export type CompilationResultOutput = CompilationResultBaseOutput;

/**
 * Schema for benchmark metrics that matches the CompilationMetrics interface.
 * Present when benchmark mode is enabled during compilation.
 */
export const BenchmarkMetricsSchema: z.ZodType<BenchmarkMetricsOutput> = z.object({
    totalDurationMs: z.number().nonnegative().describe('Total end-to-end compilation duration in milliseconds'),
    stages: z.array(z.object({
        name: z.string().describe('Stage name'),
        durationMs: z.number().nonnegative().describe('Stage duration in milliseconds'),
        itemCount: z.number().int().nonnegative().optional().describe('Number of items processed in this stage'),
        itemsPerSecond: z.number().nonnegative().optional().describe('Processing throughput (items per second)'),
    })).describe('Per-stage timing breakdown'),
    sourceCount: z.number().int().nonnegative().describe('Number of sources processed'),
    ruleCount: z.number().int().nonnegative().describe('Total number of input rules'),
    outputRuleCount: z.number().int().nonnegative().describe('Number of rules in the final output'),
});
export type BenchmarkMetrics = BenchmarkMetricsOutput;

/**
 * Schema for worker compilation result (extends CompilationResultSchema with optional metrics)
 */
export const WorkerCompilationResultSchema: z.ZodType<WorkerCompilationResultOutput> = compilationResultBase.extend({
    metrics: BenchmarkMetricsSchema.optional(),
});

// ============================================================================
// CLI and Environment Schemas
// ============================================================================

/**
 * Schema for CLI arguments (matches ParsedArguments interface in ArgumentParser.ts)
 */
export const CliArgumentsSchema: z.ZodType<CliArgumentsOutput> = z.object({
    config: z.string().optional().describe('Path to a configuration file (-c)'),
    input: z.array(z.string()).optional().describe('Input filter list source URLs or paths (-i)'),
    inputType: z.enum(['adblock', 'hosts']).optional().describe('Input format type'),
    output: z.string().optional().describe('Output file path (-o)'),
    stdout: z.boolean().optional().describe('Write output to stdout instead of a file'),
    append: z.boolean().optional().describe('Append to output file instead of overwriting'),
    format: z.string().optional().describe('Output format'),
    name: z.string().optional().describe('Path to an existing file to compare output against'),
    maxRules: z.number().int().positive().optional().describe('Truncate output to at most this many rules'),
    verbose: z.boolean().optional().describe('Enable verbose logging'),
    benchmark: z.boolean().optional().describe('Enable benchmark metrics collection'),
    useQueue: z.boolean().optional().describe('Submit compilation job to the queue'),
    priority: PrioritySchema.optional().describe('Job processing priority level'),
    help: z.boolean().optional().describe('Show help information'),
    version: z.boolean().optional().describe('Show version information'),
    // Transformation control
    noDeduplicate: z.boolean().optional().describe('Skip the Deduplicate transformation'),
    noValidate: z.boolean().optional().describe('Skip the Validate transformation'),
    noCompress: z.boolean().optional().describe('Skip the Compress transformation'),
    noComments: z.boolean().optional().describe('Skip the RemoveComments transformation'),
    invertAllow: z.boolean().optional().describe('Apply the InvertAllow transformation'),
    removeModifiers: z.boolean().optional().describe('Apply the RemoveModifiers transformation'),
    allowIp: z.boolean().optional().describe('Use ValidateAllowIp instead of Validate'),
    convertToAscii: z.boolean().optional().describe('Apply the ConvertToAscii transformation'),
    transformation: z.array(z.nativeEnum(TransformationType)).optional().describe('Explicit transformation pipeline (overrides all other transformation flags)'),
    // Filtering
    exclude: z.array(z.string()).optional().describe('Exclusion rules or wildcards'),
    excludeFrom: z.array(z.string()).optional().describe('Files containing exclusion rules'),
    include: z.array(z.string()).optional().describe('Inclusion rules or wildcards'),
    includeFrom: z.array(z.string()).optional().describe('Files containing inclusion rules'),
    // Networking
    timeout: z.number().int().positive().optional().describe('HTTP request timeout in milliseconds'),
    retries: z.number().int().nonnegative().optional().describe('Number of HTTP retry attempts'),
    userAgent: z.string().optional().describe('Custom HTTP User-Agent header'),
    // Authentication (for remote API calls via --use-queue)
    apiKey: z.string().regex(/^abc_.+$/, 'API key must start with "abc_" followed by key material').optional().describe(
        'API key for authenticated worker API requests (abc_ prefix)',
    ),
    bearerToken: z.string().optional().describe('Clerk JWT bearer token for authenticated requests'),
    apiUrl: z.string().url().optional().describe('Base URL for the worker API'),
}).refine(
    (args) => args.help || args.version || !!(args.input?.length || args.config),
    {
        message: 'Either --input or --config must be specified (or --help/--version)',
        path: ['input'],
    },
).refine(
    (args) => args.help || args.version || !!args.output || !!args.stdout,
    {
        message: '--output is required',
        path: ['output'],
    },
).refine(
    (args) => !(args.config && args.input && args.input.length > 0),
    {
        message: 'Cannot specify both config file (-c) and input sources (-i)',
        path: ['config'],
    },
).refine(
    (args) => !(args.stdout && args.output),
    {
        message: 'Cannot specify both --stdout and --output',
        path: ['stdout'],
    },
).refine(
    (args) => !(args.apiKey && args.bearerToken),
    {
        message: 'Cannot specify both --api-key and --bearer-token; choose one authentication method',
        path: ['apiKey'],
    },
);
export type CliArguments = CliArgumentsOutput;

/**
 * Schema for Worker environment bindings and runtime env vars
 */
export const EnvironmentSchema: z.ZodType<EnvironmentOutput> = z.object({
    TURNSTILE_SECRET_KEY: z.string().optional().describe('Cloudflare Turnstile secret key for bot protection'),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().optional().describe('Maximum requests per rate-limit window'),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().optional().describe('Rate-limit window duration in milliseconds'),
    CACHE_TTL: z.coerce.number().int().positive().optional().describe('Cache time-to-live in seconds'),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).optional().describe('Minimum log level to emit'),
}).passthrough(); // Allow additional worker bindings
export type Environment = EnvironmentOutput;

// ============================================================================
// Filter Rule Schemas
// ============================================================================

/**
 * Schema for a parsed adblock-syntax rule
 */
export const AdblockRuleSchema: z.ZodType<AdblockRuleOutput> = z.object({
    ruleText: z.string().min(1),
    pattern: z.string(),
    whitelist: z.boolean(),
    options: z.array(z.object({
        name: z.string(),
        value: z.string().nullable(),
    })).nullable(),
    hostname: z.string().nullable(),
});
export type AdblockRule = AdblockRuleOutput;

/**
 * Schema for a parsed /etc/hosts-syntax rule
 */
export const EtcHostsRuleSchema: z.ZodType<EtcHostsRuleOutput> = z.object({
    ruleText: z.string().min(1),
    hostnames: z.array(z.string()).nonempty(),
});
export type EtcHostsRule = EtcHostsRuleOutput;
