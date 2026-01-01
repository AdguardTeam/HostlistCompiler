// Main entry point for the hostlist compiler library

// Types
export * from './types/index.ts';

// Utils
export { RuleUtils, StringUtils, Wildcard, TldUtils } from './utils/index.ts';
export type { ParsedHost } from './utils/index.ts';

// Event system for observability
export { CompilerEventEmitter, NoOpEventEmitter, createEventEmitter } from './utils/index.ts';

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

// Default export for backward compatibility
import { compile as compileFunc } from './compiler/index.ts';
export default compileFunc;
