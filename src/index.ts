// Main entry point for the hostlist compiler library

// Version information
export { VERSION, PACKAGE_NAME, PACKAGE_INFO, USER_AGENT } from './version.ts';

// Configuration constants
export {
    NETWORK_DEFAULTS,
    PREPROCESSOR_DEFAULTS,
    WORKER_DEFAULTS,
    STORAGE_DEFAULTS,
    COMPILATION_DEFAULTS,
    VALIDATION_DEFAULTS,
    DEFAULTS,
    OutputFormat,
    RuleType,
    HealthStatus,
} from './config/index.ts';

// Types
export * from './types/index.ts';

// Utils
export { RuleUtils, StringUtils, Wildcard, TldUtils } from './utils/index.ts';
export type { ParsedHost } from './utils/index.ts';

// Error utilities
export { ErrorUtils, CompilationError, ValidationError, NetworkError, SourceError } from './utils/index.ts';

// Boolean expression parser
export { evaluateBooleanExpression, isKnownPlatform, getKnownPlatforms } from './utils/index.ts';

// Event system for observability
export { CompilerEventEmitter, NoOpEventEmitter, createEventEmitter } from './utils/index.ts';

// Diagnostics and tracing for tail worker integration
export {
    DiagnosticsCollector,
    NoOpDiagnosticsCollector,
    createTracingContext,
    createChildContext,
    createNoOpContext,
    traceSync,
    traceAsync,
} from './diagnostics/index.ts';
export type {
    TraceSeverity,
    TraceCategory,
    DiagnosticEvent,
    OperationStartEvent,
    OperationCompleteEvent,
    OperationErrorEvent,
    PerformanceMetricEvent,
    CacheEvent,
    NetworkEvent,
    IDiagnosticsCollector,
    TracingContext,
    TracingContextOptions,
} from './diagnostics/index.ts';

// Downloader
export { FilterDownloader } from './downloader/index.ts';
export type { DownloaderOptions } from './downloader/index.ts';

// Configuration
export { ConfigurationValidator } from './configuration/index.ts';

// Transformations
export {
    Transformation,
    SyncTransformation,
    AsyncTransformation,
    RemoveCommentsTransformation,
    TrimLinesTransformation,
    RemoveEmptyLinesTransformation,
    InsertFinalNewLineTransformation,
    ConvertToAsciiTransformation,
    InvertAllowTransformation,
    RemoveModifiersTransformation,
    DeduplicateTransformation,
    ValidateTransformation,
    ValidateAllowIpTransformation,
    CompressTransformation,
    ExcludeTransformation,
    IncludeTransformation,
    TransformationRegistry,
    TransformationPipeline,
} from './transformations/index.ts';

// Services
export { FilterService } from './services/index.ts';

// Compiler
export { SourceCompiler, FilterCompiler, compile } from './compiler/index.ts';
export type { CompilationResult, FilterCompilerOptions } from './compiler/index.ts';

// Platform abstraction layer (for Web Workers, Cloudflare Workers, browsers)
export {
    HttpFetcher,
    PreFetchedContentFetcher,
    CompositeFetcher,
    PlatformDownloader,
    WorkerCompiler,
} from './platform/index.ts';
export type {
    IContentFetcher,
    IHttpFetcherOptions,
    PreFetchedContent,
    IPlatformCompilerOptions,
    PlatformDownloaderOptions,
    WorkerCompilerOptions,
    WorkerCompilationResult,
} from './platform/index.ts';

// Incremental compilation
export { IncrementalCompiler, MemoryCacheStorage } from './compiler/IncrementalCompiler.ts';
export type {
    SourceCacheEntry,
    ICacheStorage,
    IncrementalCompilerOptions,
    IncrementalCompilationResult,
} from './compiler/IncrementalCompiler.ts';

// Header generation
export { HeaderGenerator } from './compiler/HeaderGenerator.ts';
export type { HeaderOptions } from './compiler/HeaderGenerator.ts';

// Output formatters
export {
    formatOutput,
    createFormatter,
    HostsFormatter,
    DnsmasqFormatter,
    PiHoleFormatter,
    UnboundFormatter,
    JsonFormatter,
    DoHFormatter,
    AdblockFormatter,
} from './formatters/index.ts';
export type { FormatterOptions, FormatterResult } from './formatters/index.ts';

// Diff reports
export { DiffGenerator, generateDiff, generateDiffMarkdown } from './diff/index.ts';
export type { RuleDiff, DiffSummary, DomainDiff, DiffReport, DiffOptions } from './diff/index.ts';

// Conflict detection
export { ConflictDetectionTransformation, detectConflicts } from './transformations/ConflictDetectionTransformation.ts';
export type {
    RuleConflict,
    ConflictDetectionOptions,
    ConflictDetectionResult,
} from './transformations/ConflictDetectionTransformation.ts';

// Rule optimizer
export { RuleOptimizerTransformation, optimizeRules } from './transformations/RuleOptimizerTransformation.ts';
export type { OptimizationStats, RuleOptimizerOptions } from './transformations/RuleOptimizerTransformation.ts';

// Plugin system
export {
    PluginRegistry,
    PluginTransformationWrapper,
    loadPlugin,
    createSimplePlugin,
    globalRegistry,
} from './plugins/index.ts';
export type {
    PluginManifest,
    TransformationPlugin,
    DownloaderPlugin,
    Plugin,
    PluginContext,
    PluginLoadOptions,
} from './plugins/index.ts';

// Default export for backward compatibility
import { compile as compileFunc } from './compiler/index.ts';
export default compileFunc;
