/**
 * @module configuration
 * Configuration validation and Zod schema exports for the AdBlock Compiler.
 *
 * Provides two categories of exports:
 * - {@link ConfigurationValidator} – validates compiler configuration objects at
 *   runtime, throwing descriptive errors for missing or invalid fields.
 * - **Zod schemas** – strongly-typed runtime validators for every public data shape
 *   (sources, compilation requests, results, environment, CLI arguments, etc.).
 *   These schemas can be used independently for request validation in API layers.
 */
export { ConfigurationValidator } from './ConfigurationValidator.ts';

// Zod schemas for runtime validation
export {
    AdblockRuleSchema,
    BatchRequestAsyncSchema,
    BatchRequestSchema,
    BatchRequestSyncSchema,
    BenchmarkMetricsSchema,
    CliArgumentsSchema,
    CompilationResultSchema,
    CompileRequestSchema,
    ConfigurationSchema,
    EnvironmentSchema,
    EtcHostsRuleSchema,
    HttpFetcherOptionsSchema,
    PlatformCompilerOptionsSchema,
    SourceSchema,
    ValidationErrorSchema,
    ValidationErrorTypeSchema,
    ValidationReportSchema,
    ValidationResultSchema,
    ValidationSeveritySchema,
    WorkerCompilationResultSchema,
} from './schemas.ts';
export type { AdblockRule, BenchmarkMetrics, CliArguments, CompilationResultOutput, Environment, EtcHostsRule, WorkerCompilationResultOutput } from './schemas.ts';
