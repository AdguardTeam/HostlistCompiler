/**
 * Zod schemas for runtime validation with TypeScript integration.
 * Provides type-safe validation for configuration objects.
 */

import { z } from 'zod';
import { type IConfiguration, type ISource, SourceType, TransformationType } from '../types/index.ts';

// ============================================================================
// Output types for schemas without matching public interfaces
// ============================================================================

type Priority = 'standard' | 'high';

type CompileRequestOutput = {
    configuration: IConfiguration;
    preFetchedContent?: Record<string, string>;
    benchmark?: boolean;
    priority?: Priority;
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
    priority?: Priority;
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
    source: z.string().trim().min(1, 'source is required and must be a non-empty string'),
    name: z.string().trim().min(1, 'name must be a non-empty string').optional(),
    type: SourceTypeSchema.optional(),
}).merge(FilterableSchema).merge(TransformableSchema).strict()
    .refine(hasValidTransformationOrdering, transformationOrderingMessage)
    .transform((data) => ({
        ...data,
        source: data.source.trim(),
        name: data.name?.trim() || data.name,
    }));

/**
 * Schema for IConfiguration validation
 */
export const ConfigurationSchema: z.ZodType<IConfiguration> = z.object({
    name: z.string().min(1, 'name is required and must be a non-empty string'),
    description: z.string().optional(),
    homepage: z.string().optional(),
    license: z.string().optional(),
    version: z.string().optional(),
    sources: z.array(SourceSchema).nonempty('sources is required and must be a non-empty array'),
}).merge(FilterableSchema).merge(TransformableSchema).strict()
    .refine(hasValidTransformationOrdering, transformationOrderingMessage);

/**
 * Schema for CompileRequest validation (worker)
 */
export const CompileRequestSchema: z.ZodType<CompileRequestOutput> = z.object({
    configuration: ConfigurationSchema,
    preFetchedContent: PreFetchedContentSchema,
    benchmark: z.boolean().optional(),
    priority: z.enum(['standard', 'high']).optional(),
    turnstileToken: z.string().optional(),
});

/**
 * Schema for BatchRequest validation (worker)
 */
export const BatchRequestSchema: z.ZodType<BatchRequestOutput> = z.object({
    requests: z.array(
        z.object({
            id: z.string().min(1, 'id is required and must be a non-empty string'),
            configuration: ConfigurationSchema,
            preFetchedContent: PreFetchedContentSchema,
            benchmark: z.boolean().optional(),
        }),
    ).nonempty('requests array must not be empty'),
    priority: z.enum(['standard', 'high']).optional(),
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

type WorkerCompilationResultType = CompilationResultBaseOutput & {
    metrics?: BenchmarkMetricsOutput;
};

type CliArgumentsOutput = {
    config?: string;
    input?: string[];
    inputType?: 'adblock' | 'hosts';
    output?: string;
    verbose?: boolean;
    benchmark?: boolean;
    useQueue?: boolean;
    priority?: 'standard' | 'high';
    help?: boolean;
    version?: boolean;
};

type EnvironmentOutput = {
    TURNSTILE_SECRET_KEY?: string;
    RATE_LIMIT_MAX_REQUESTS?: number;
    RATE_LIMIT_WINDOW_MS?: number;
    CACHE_TTL?: number;
    LOG_LEVEL?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
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
    totalDurationMs: z.number().nonnegative(),
    stages: z.array(z.object({
        name: z.string(),
        durationMs: z.number().nonnegative(),
        itemCount: z.number().int().nonnegative().optional(),
        itemsPerSecond: z.number().nonnegative().optional(),
    })),
    sourceCount: z.number().int().nonnegative(),
    ruleCount: z.number().int().nonnegative(),
    outputRuleCount: z.number().int().nonnegative(),
});
export type BenchmarkMetrics = BenchmarkMetricsOutput;

/**
 * Schema for worker compilation result (extends CompilationResultSchema with optional metrics)
 */
export const WorkerCompilationResultSchema: z.ZodType<WorkerCompilationResultType> = compilationResultBase.extend({
    metrics: BenchmarkMetricsSchema.optional(),
});
export type WorkerCompilationResultOutput = WorkerCompilationResultType;

// ============================================================================
// CLI and Environment Schemas
// ============================================================================

/**
 * Schema for CLI arguments (matches ParsedArguments interface in ArgumentParser.ts)
 */
export const CliArgumentsSchema: z.ZodType<CliArgumentsOutput> = z.object({
    config: z.string().optional(),
    input: z.array(z.string()).optional(),
    inputType: z.enum(['adblock', 'hosts']).optional(),
    output: z.string().optional(),
    verbose: z.boolean().optional(),
    benchmark: z.boolean().optional(),
    useQueue: z.boolean().optional(),
    priority: z.enum(['standard', 'high']).optional(),
    help: z.boolean().optional(),
    version: z.boolean().optional(),
}).refine(
    (args) => args.help || args.version || !!(args.input?.length || args.config),
    {
        message: 'Either --input or --config must be specified (or --help/--version)',
        path: ['input'],
    },
).refine(
    (args) => args.help || args.version || !!args.output,
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
);
export type CliArguments = CliArgumentsOutput;

/**
 * Schema for Worker environment bindings and runtime env vars
 */
export const EnvironmentSchema: z.ZodType<EnvironmentOutput> = z.object({
    TURNSTILE_SECRET_KEY: z.string().optional(),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().optional(),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().optional(),
    CACHE_TTL: z.coerce.number().int().positive().optional(),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).optional(),
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
