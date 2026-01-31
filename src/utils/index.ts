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
export { createLogger, Logger, logger, LogLevel, silentLogger } from './logger.ts';
export type { LoggerOptions } from './logger.ts';

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

// Path utilities
export { PathUtils } from './PathUtils.ts';

// Boolean expression parser (safe alternative to Function constructor)
export { evaluateBooleanExpression, getKnownPlatforms, isKnownPlatform } from './BooleanExpressionParser.ts';
