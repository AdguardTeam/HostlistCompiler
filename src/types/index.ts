/**
 * Core type definitions for the hostlist compiler
 */

/**
 * Enum of all available transformation types
 */
export enum TransformationType {
    RemoveComments = 'RemoveComments',
    Compress = 'Compress',
    RemoveModifiers = 'RemoveModifiers',
    Validate = 'Validate',
    ValidateAllowIp = 'ValidateAllowIp',
    Deduplicate = 'Deduplicate',
    InvertAllow = 'InvertAllow',
    RemoveEmptyLines = 'RemoveEmptyLines',
    TrimLines = 'TrimLines',
    InsertFinalNewLine = 'InsertFinalNewLine',
    ConvertToAscii = 'ConvertToAscii',
}

/**
 * Source type for filter lists
 */
export enum SourceType {
    Adblock = 'adblock',
    Hosts = 'hosts',
}

/**
 * Common interface for filterable entities
 * Follows Interface Segregation Principle - shared filter properties
 */
export interface IFilterable {
    /** List of rules or wildcards to exclude */
    exclusions?: string[];
    /** List of files with exclusions */
    exclusions_sources?: string[];
    /** List of wildcards to include */
    inclusions?: string[];
    /** List of files with inclusions */
    inclusions_sources?: string[];
}

/**
 * Common interface for transformable entities
 * Follows Interface Segregation Principle - shared transformation properties
 */
export interface ITransformable {
    /** List of transformations to apply */
    transformations?: TransformationType[];
}

/**
 * A source configuration for a filter list
 */
export interface ISource extends IFilterable, ITransformable {
    /** Path or URL of the source (required) */
    source: string;
    /** Name of the source */
    name?: string;
    /** Type of the source (adblock or hosts) */
    type?: SourceType;
}

/**
 * Main configuration for the hostlist compiler
 */
export interface IConfiguration extends IFilterable, ITransformable {
    /** Filter list name (required) */
    name: string;
    /** Filter list description */
    description?: string;
    /** Filter list homepage */
    homepage?: string;
    /** Filter list license */
    license?: string;
    /** Filter version */
    version?: string;
    /** Array of filter list sources (required) */
    sources: ISource[];
}

/**
 * Result of configuration validation
 */
export interface IValidationResult {
    /** Whether the configuration is valid */
    valid: boolean;
    /** Error message text if invalid, null if valid */
    errorsText: string | null;
}

/**
 * Represents a rule modifier/option
 */
export interface IRuleModifier {
    /** Modifier name (e.g., 'third-party', 'domain') */
    name: string;
    /** Modifier value, or null if no value */
    value: string | null;
}

/**
 * Token representation of a parsed adblock rule
 */
export interface IAdblockRuleTokens {
    /** The pattern part of the rule */
    pattern: string | null;
    /** The options/modifiers part of the rule */
    options: string | null;
    /** Whether this is a whitelist/exception rule */
    whitelist: boolean;
}

/**
 * Parsed /etc/hosts rule
 */
export interface IEtcHostsRule {
    /** Original rule text */
    ruleText: string;
    /** List of hostnames in the rule */
    hostnames: string[];
}

/**
 * Parsed adblock-style rule
 */
export interface IAdblockRule {
    /** Original rule text */
    ruleText: string;
    /** Pattern extracted from the rule */
    pattern: string;
    /** Whether this is a whitelist/exception rule */
    whitelist: boolean;
    /** Parsed options/modifiers, or null if none */
    options: IRuleModifier[] | null;
    /** Extracted hostname, or null if not a domain rule */
    hostname: string | null;
}

/**
 * Blocklist rule for compression
 */
export interface IBlocklistRule {
    /** Current rule text (may be modified) */
    ruleText: string;
    /** Whether the rule can be compressed */
    canCompress: boolean;
    /** Extracted hostname, or null if not applicable */
    hostname: string | null;
    /** Original unmodified rule text */
    originalRuleText: string;
}

/**
 * Basic logger interface with essential methods
 * Follows Interface Segregation Principle
 */
export interface IBasicLogger {
    /**
     * Log an informational message
     * @param message - The message to log
     */
    info(message: string): void;
    /**
     * Log a warning message
     * @param message - The message to log
     */
    warn(message: string): void;
    /**
     * Log an error message
     * @param message - The message to log
     */
    error(message: string): void;
}

/**
 * Detailed logger interface with debug capabilities
 * Extends IBasicLogger for advanced logging needs
 */
export interface IDetailedLogger extends IBasicLogger {
    /**
     * Log a debug message
     * @param message - The message to log
     */
    debug(message: string): void;
    /**
     * Log a trace message
     * @param message - The message to log
     */
    trace(message: string): void;
}

/**
 * Logger interface for backward compatibility
 * @deprecated Use IBasicLogger or IDetailedLogger instead
 */
export interface ILogger extends IDetailedLogger {
    // Kept for backward compatibility
}

/**
 * Downloader interface for dependency injection
 * Allows different downloader implementations
 */
export interface IDownloader {
    /**
     * Download filter rules from a source
     * @param source - The source URL or path
     * @returns Promise resolving to array of rules
     */
    download(source: string): Promise<string[]>;
}

/**
 * Filter downloader interface for dependency injection
 * @deprecated Use IDownloader instead
 */
export interface IFilterDownloader {
    /**
     * Download filter rules from a source
     * @param source - The source URL or path
     * @param options - Download options
     * @param additionalOptions - Additional options
     * @returns Promise resolving to array of rules
     */
    download(source: string, options?: object, additionalOptions?: object): Promise<string[]>;
}

/**
 * File system operations interface for dependency injection
 * Allows testing and different implementations
 */
export interface IFileSystem {
    /**
     * Read a text file
     * @param path - The file path
     * @returns Promise resolving to file contents
     */
    readTextFile(path: string): Promise<string>;
    /**
     * Write a text file
     * @param path - The file path
     * @param content - The content to write
     */
    writeTextFile(path: string, content: string): Promise<void>;
    /**
     * Check if a file exists
     * @param path - The file path
     * @returns Promise resolving to true if file exists
     */
    exists(path: string): Promise<boolean>;
}

/**
 * HTTP client interface for dependency injection
 * Allows testing and different HTTP implementations
 */
export interface IHttpClient {
    /**
     * Fetch a resource from a URL
     * @param url - The URL to fetch
     * @param options - Fetch options
     * @returns Promise resolving to the Response
     */
    fetch(url: string, options?: RequestInit): Promise<Response>;
}

/**
 * Options for transformations that can be configured
 */
export interface ITransformationOptions {
    /** Whether to allow IP address rules */
    allowIp?: boolean;
}

/**
 * Context passed to transformations
 */
export interface ITransformationContext {
    /** The configuration or source being processed */
    configuration: IConfiguration | ISource;
    /** Logger instance for output */
    logger: ILogger;
}

// ============================================================================
// Event System Types
// ============================================================================

/**
 * Event emitted when a source starts downloading
 */
export interface ISourceStartEvent {
    /** The source being compiled */
    source: ISource;
    /** Index of the source in the configuration */
    sourceIndex: number;
    /** Total number of sources */
    totalSources: number;
}

/**
 * Event emitted when a source completes successfully
 */
export interface ISourceCompleteEvent {
    /** The source that was compiled */
    source: ISource;
    /** Index of the source in the configuration */
    sourceIndex: number;
    /** Total number of sources */
    totalSources: number;
    /** Number of rules fetched from the source */
    ruleCount: number;
    /** Time taken to compile this source in milliseconds */
    durationMs: number;
}

/**
 * Event emitted when a source fails to compile
 */
export interface ISourceErrorEvent {
    /** The source that failed */
    source: ISource;
    /** Index of the source in the configuration */
    sourceIndex: number;
    /** Total number of sources */
    totalSources: number;
    /** The error that occurred */
    error: Error;
}

/**
 * Event emitted when a transformation starts
 */
export interface ITransformationStartEvent {
    /** Name of the transformation */
    name: string;
    /** Number of rules before transformation */
    inputCount: number;
}

/**
 * Event emitted when a transformation completes
 */
export interface ITransformationCompleteEvent {
    /** Name of the transformation */
    name: string;
    /** Number of rules before transformation */
    inputCount: number;
    /** Number of rules after transformation */
    outputCount: number;
    /** Time taken for transformation in milliseconds */
    durationMs: number;
}

/**
 * Event emitted to report compilation progress
 */
export interface IProgressEvent {
    /** Current phase of compilation */
    phase: 'sources' | 'transformations' | 'finalize';
    /** Current item being processed */
    current: number;
    /** Total items in this phase */
    total: number;
    /** Human-readable message */
    message: string;
}

/**
 * Event emitted when compilation completes
 */
export interface ICompilationCompleteEvent {
    /** Total number of output rules */
    ruleCount: number;
    /** Total compilation time in milliseconds */
    totalDurationMs: number;
    /** Number of sources processed */
    sourceCount: number;
    /** Number of transformations applied */
    transformationCount: number;
}

/**
 * Callback function types for compiler events
 */
export interface ICompilerEvents {
    /** Called when a source starts downloading */
    onSourceStart?: (event: ISourceStartEvent) => void;
    /** Called when a source completes successfully */
    onSourceComplete?: (event: ISourceCompleteEvent) => void;
    /** Called when a source fails to compile */
    onSourceError?: (event: ISourceErrorEvent) => void;
    /** Called when a transformation starts */
    onTransformationStart?: (event: ITransformationStartEvent) => void;
    /** Called when a transformation completes */
    onTransformationComplete?: (event: ITransformationCompleteEvent) => void;
    /** Called to report progress */
    onProgress?: (event: IProgressEvent) => void;
    /** Called when compilation completes */
    onCompilationComplete?: (event: ICompilationCompleteEvent) => void;
}
