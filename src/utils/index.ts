/**
 * @module utils
 * Utility library for the AdBlock Compiler.
 *
 * Provides a wide range of cross-cutting helpers grouped by concern:
 *
 * - **Rule utilities** – {@link RuleUtils}: classify, parse, and manipulate
 *   individual adblock/hosts rule strings.
 * - **AGTree parser** – {@link AGTreeParser}: full AST parsing of adblock rules via
 *   `@adguard/agtree`, with re-exported types for every AST node shape.
 * - **String utilities** – {@link StringUtils}: common string operations (trimming,
 *   splitting, wildcard matching, punycode conversion, etc.).
 * - **TLD utilities** – {@link TldUtils}: public-suffix list helpers.
 * - **Wildcard** – {@link Wildcard}: glob-style pattern matching.
 * - **Logging** – {@link Logger}, {@link StructuredLogger}, factory functions
 *   (`createLogger`, `createLoggerFromEnv`), log levels, and module-level overrides.
 * - **Error utilities** – {@link BaseError}, {@link CompilationError},
 *   {@link NetworkError}, {@link SourceError}, {@link ValidationError}, and
 *   {@link ErrorUtils} for extracting messages from unknown error values.
 * - **Circuit breaker** – {@link CircuitBreaker}: resilience pattern with
 *   configurable thresholds and half-open recovery.
 * - **Boolean expression evaluator** – {@link evaluateBooleanExpression},
 *   {@link getKnownPlatforms}, {@link isKnownPlatform}: evaluates preprocessor
 *   `!if` directives in filter lists.
 * - **Event emitter** – {@link CompilerEventEmitter}, {@link NoOpEventEmitter}:
 *   observable progress/warning/error events during compilation.
 * - **Benchmarking** – {@link BenchmarkResult} and related types.
 */
// Rule utilities
export { RuleUtils } from './RuleUtils.ts';

// AGTree Parser (adblock rule parsing with AST)
export { AdblockSyntax, AdblockSyntaxError, AGTreeParser, CommentRuleType, CosmeticRuleType, NetworkRuleType, RuleCategory } from './AGTreeParser.ts';
export type {
    AnyCommentRule,
    AnyCosmeticRule,
    AnyNetworkRule,
    AnyRule,
    CommentRule,
    CosmeticRule,
    CosmeticRuleProperties,
    EmptyRule,
    ExtractedModifier,
    FilterList,
    HostRule,
    HostRuleProperties,
    MetadataCommentRule,
    Modifier,
    ModifierList,
    NetworkRule,
    NetworkRuleProperties,
    ParseResult,
    ParserOptions,
} from './AGTreeParser.ts';

// String utilities
export { StringUtils } from './StringUtils.ts';
export * from './StringUtils.ts'; // Export functional utilities

// Wildcard and TLD utilities
export { Wildcard } from './Wildcard.ts';
export { TldUtils } from './TldUtils.ts';
export type { ParsedHost } from './TldUtils.ts';

// Async utilities
export { RetryStrategies, withRetry } from './AsyncRetry.ts';
export type { RetryOptions, RetryResult } from './AsyncRetry.ts';

// Logging
export { createLogger, createLoggerFromEnv, Logger, logger, LogLevel, parseModuleOverrides, silentLogger, StructuredLogger } from './logger.ts';
export type { LoggerOptions, ModuleOverrides } from './logger.ts';

// Benchmarking
export { BenchmarkCollector, formatDuration, formatNumber, Timer } from './Benchmark.ts';
export type { BenchmarkResult, CompilationMetrics } from './Benchmark.ts';

// Event system
export { CompilerEventEmitter, createEventEmitter, NoOpEventEmitter } from './EventEmitter.ts';

// Checksum utilities
export { addChecksumToHeader, calculateChecksum } from './checksum.ts';

// Header filtering utilities
export { stripUpstreamHeaders } from './headerFilter.ts';

// Error utilities
export {
    BaseError,
    CompilationError,
    ConfigurationError,
    ErrorCode,
    ErrorUtils,
    FileSystemError,
    NetworkError,
    SourceError,
    StorageError,
    TransformationError,
    ValidationError,
} from './ErrorUtils.ts';

// Error reporting
export { CloudflareErrorReporter, CompositeErrorReporter, ConsoleErrorReporter, NoOpErrorReporter, SentryErrorReporter } from './ErrorReporter.ts';
export type { AnalyticsEngineDataset, ErrorContext, IErrorReporter } from './ErrorReporter.ts';

// Path utilities
export { PathUtils } from './PathUtils.ts';

// Boolean expression parser (safe alternative to Function constructor)
export { evaluateBooleanExpression, getKnownPlatforms, isKnownPlatform } from './BooleanExpressionParser.ts';

// Circuit breaker for resilience
export { CircuitBreaker, CircuitBreakerOpenError, CircuitBreakerState } from './CircuitBreaker.ts';
export type { CircuitBreakerOptions } from './CircuitBreaker.ts';
