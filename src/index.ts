/**
 * @module adblock-compiler
 * Main entry point for the `@jk-com/adblock-compiler` library.
 *
 * This module re-exports the complete public API surface of the AdBlock Compiler,
 * organised into the following logical groups:
 *
 * - **Version** – package identity constants (`VERSION`, `USER_AGENT`, …)
 * - **Configuration** – defaults, enums, and output-format constants
 * - **Types** – all shared TypeScript interfaces and type aliases
 * - **Utils** – rule utilities, logging, error helpers, circuit-breaker, boolean
 *   expression evaluator, and the compiler event system
 * - **Diagnostics** – OpenTelemetry-compatible tracing and diagnostics collector
 * - **Downloader** – `FilterDownloader` for fetching remote filter lists
 * - **Schemas** – Zod validation schemas for all public data shapes
 * - **Transformations** – the full transformation pipeline and every built-in rule
 *   transformation (compress, deduplicate, validate, etc.)
 * - **Services** – `FilterService`, `ASTViewerService`, and analytics service
 * - **Compiler** – `FilterCompiler`, `SourceCompiler`, `IncrementalCompiler`, and
 *   the top-level `compile()` convenience function
 * - **Platform** – cross-runtime abstraction layer with `WorkerCompiler` and
 *   pluggable content fetchers for Cloudflare Workers / Deno Deploy
 * - **Formatters** – output formatters for adblock, hosts, dnsmasq, DoH, etc.
 * - **Diff** – `DiffGenerator` for comparing two compiled filter lists
 * - **Plugins** – the extensible plugin registry and plugin wrapper API
 * - **Conflict Detection** – `ConflictDetectionTransformation` and `detectConflicts()` for
 *   finding and resolving conflicting block/allow rules
 * - **Rule Optimizer** – `RuleOptimizerTransformation` and `optimizeRules()` for reducing
 *   file size and improving matching performance
 *
 * @example Install and compile a list
 * ```ts
 * import { compile } from '@jk-com/adblock-compiler';
 *
 * const result = await compile({
 *   sources: [{ url: 'https://example.com/list.txt' }],
 *   transformations: ['RemoveComments', 'Deduplicate'],
 * });
 * console.log(result.rules.join('\n'));
 * ```
 *
 * @packageDocumentation
 */
// Version information
export { PACKAGE_INFO, PACKAGE_NAME, USER_AGENT, VERSION } from './version.ts';

// Configuration constants
export {
    COMPILATION_DEFAULTS,
    DEFAULTS,
    HealthStatus,
    NETWORK_DEFAULTS,
    OutputFormat,
    PREPROCESSOR_DEFAULTS,
    RuleType,
    STORAGE_DEFAULTS,
    VALIDATION_DEFAULTS,
    WORKER_DEFAULTS,
} from './config/index.ts';

// Types
export * from './types/index.ts';

// Utils
export { RuleUtils, StringUtils, TldUtils, Wildcard } from './utils/index.ts';
export type { BenchmarkResult, CompilationMetrics, ParsedHost } from './utils/index.ts';

// Logging
export { createLogger, createLoggerFromEnv, Logger, logger, LogLevel, parseModuleOverrides, silentLogger, StructuredLogger } from './utils/index.ts';
export type { LoggerOptions, ModuleOverrides } from './utils/index.ts';

// Error utilities
export { BaseError, CompilationError, ErrorUtils, NetworkError, SourceError, ValidationError } from './utils/index.ts';

// Circuit breaker for resilience
export { CircuitBreaker, CircuitBreakerOpenError, CircuitBreakerState } from './utils/index.ts';
export type { CircuitBreakerOptions } from './utils/index.ts';

// Boolean expression parser
export { evaluateBooleanExpression, getKnownPlatforms, isKnownPlatform } from './utils/index.ts';

// Event system for observability
export { CompilerEventEmitter, createEventEmitter, NoOpEventEmitter } from './utils/index.ts';

// Diagnostics and tracing for tail worker integration
export {
    createChildContext,
    createNoOpContext,
    createOpenTelemetryExporter,
    createTracingContext,
    DiagnosticsCollector,
    NoOpDiagnosticsCollector,
    OpenTelemetryExporter,
    traceAsync,
    TraceCategory,
    TraceSeverity,
    traceSync,
} from './diagnostics/index.ts';
export type {
    AnyDiagnosticEvent,
    CacheEvent,
    DiagnosticEvent,
    IDiagnosticsCollector,
    NetworkEvent,
    OpenTelemetryExporterOptions,
    OperationCompleteEvent,
    OperationErrorEvent,
    OperationStartEvent,
    PerformanceMetricEvent,
    TracingContext,
    TracingContextOptions,
} from './diagnostics/index.ts';

// Downloader
export { FilterDownloader } from './downloader/index.ts';
export type { DownloaderOptions } from './downloader/index.ts';

// Configuration and Validation Schemas
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
    ConfigurationValidator,
    EnvironmentSchema,
    EtcHostsRuleSchema,
    HttpFetcherOptionsSchema,
    PlatformCompilerOptionsSchema,
    PrioritySchema,
    SourceSchema,
    ValidationErrorSchema,
    ValidationErrorTypeSchema,
    ValidationReportSchema,
    ValidationResultSchema,
    ValidationSeveritySchema,
    WorkerCompilationResultSchema,
} from './configuration/index.ts';
export type {
    AdblockRule,
    BenchmarkMetrics,
    CliArguments,
    CompilationResultOutput,
    Environment,
    EtcHostsRule,
    Priority,
    WorkerCompilationResultOutput,
} from './configuration/index.ts';

// Transformations
export {
    AsyncTransformation,
    CompressTransformation,
    ConvertToAsciiTransformation,
    DeduplicateTransformation,
    ExcludeTransformation,
    IncludeTransformation,
    InsertFinalNewLineTransformation,
    InvertAllowTransformation,
    RemoveCommentsTransformation,
    RemoveEmptyLinesTransformation,
    RemoveModifiersTransformation,
    SyncTransformation,
    Transformation,
    TransformationPipeline,
    TransformationRegistry,
    TrimLinesTransformation,
    ValidateAllowIpTransformation,
    ValidateTransformation,
} from './transformations/index.ts';

// Transformation hooks
export { createEventBridgeHook, createLoggingHook, createMetricsHook, NoOpHookManager, TransformationHookManager } from './transformations/index.ts';
export type { AfterTransformHook, BeforeTransformHook, TransformationHookConfig, TransformationHookContext, TransformErrorHook } from './transformations/index.ts';

// Services
export { ASTViewerService, FilterService, type ParsedRuleInfo, type RuleSummary } from './services/index.ts';

// Compiler
export { compile, FilterCompiler, SourceCompiler } from './compiler/index.ts';
export type { CompilationResult, FilterCompilerOptions } from './compiler/index.ts';

// Platform abstraction layer (for Web Workers, Cloudflare Workers, browsers)
export { BrowserFetcher, CompositeFetcher, HttpFetcher, PlatformDownloader, PreFetchedContentFetcher, WorkerCompiler } from './platform/index.ts';
export type {
    BrowserConnector,
    BrowserFetcherOptions,
    IBrowserWorker,
    IContentFetcher,
    IHttpFetcherOptions,
    IPlatformCompilerOptions,
    IPlaywrightBrowser,
    IPlaywrightPage,
    PlatformDownloaderOptions,
    PreFetchedContent,
    WorkerCompilationResult,
    WorkerCompilerOptions,
} from './platform/index.ts';

// Incremental compilation
export { IncrementalCompiler, MemoryCacheStorage } from './compiler/IncrementalCompiler.ts';
export type { ICacheStorage, IncrementalCompilationResult, IncrementalCompilerOptions, SourceCacheEntry } from './compiler/IncrementalCompiler.ts';

// Header generation
export { HeaderGenerator } from './compiler/HeaderGenerator.ts';
export type { HeaderOptions } from './compiler/HeaderGenerator.ts';

// Output formatters
export {
    AdblockFormatter,
    BaseFormatter,
    createFormatter,
    DnsmasqFormatter,
    DoHFormatter,
    formatOutput,
    HostsFormatter,
    JsonFormatter,
    PiHoleFormatter,
    UnboundFormatter,
} from './formatters/index.ts';
export type { FormatterOptions, FormatterResult } from './formatters/index.ts';

// Diff reports
export { DiffGenerator, generateDiff, generateDiffMarkdown } from './diff/index.ts';
export type { DiffOptions, DiffReport, DiffSummary, DomainDiff, RuleDiff } from './diff/index.ts';

// Conflict detection
export { ConflictDetectionTransformation, detectConflicts } from './transformations/ConflictDetectionTransformation.ts';
export type { ConflictDetectionOptions, ConflictDetectionResult, RuleConflict } from './transformations/ConflictDetectionTransformation.ts';

// Rule optimizer
export { optimizeRules, RuleOptimizerTransformation } from './transformations/RuleOptimizerTransformation.ts';
export type { OptimizationStats, RuleOptimizerOptions } from './transformations/RuleOptimizerTransformation.ts';

// Plugin system
export { createSimplePlugin, globalRegistry, loadPlugin, PluginRegistry, PluginTransformationWrapper } from './plugins/index.ts';
export type { DownloaderPlugin, Plugin, PluginContext, PluginLoadOptions, PluginManifest, TransformationPlugin } from './plugins/index.ts';

// Default export for backward compatibility
import { compile as compileFunc } from './compiler/index.ts';
export default compileFunc;
