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
 * A source configuration for a filter list
 */
export interface ISource {
    /** Path or URL of the source (required) */
    source: string;
    /** Name of the source */
    name?: string;
    /** Type of the source (adblock or hosts) */
    type?: SourceType;
    /** List of transformations to apply */
    transformations?: TransformationType[];
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
 * Main configuration for the hostlist compiler
 */
export interface IConfiguration {
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
    /** List of transformations to apply globally */
    transformations?: TransformationType[];
    /** List of global exclusions */
    exclusions?: string[];
    /** List of global exclusion sources */
    exclusions_sources?: string[];
    /** List of global inclusions */
    inclusions?: string[];
    /** List of global inclusion sources */
    inclusions_sources?: string[];
}

/**
 * Result of configuration validation
 */
export interface IValidationResult {
    valid: boolean;
    errorsText: string | null;
}

/**
 * Represents a rule modifier/option
 */
export interface IRuleModifier {
    name: string;
    value: string | null;
}

/**
 * Token representation of a parsed adblock rule
 */
export interface IAdblockRuleTokens {
    pattern: string | null;
    options: string | null;
    whitelist: boolean;
}

/**
 * Parsed /etc/hosts rule
 */
export interface IEtcHostsRule {
    ruleText: string;
    hostnames: string[];
}

/**
 * Parsed adblock-style rule
 */
export interface IAdblockRule {
    ruleText: string;
    pattern: string;
    whitelist: boolean;
    options: IRuleModifier[] | null;
    hostname: string | null;
}

/**
 * Blocklist rule for compression
 */
export interface IBlocklistRule {
    ruleText: string;
    canCompress: boolean;
    hostname: string | null;
    originalRuleText: string;
}

/**
 * Logger interface for dependency injection
 */
export interface ILogger {
    info(message: string): void;
    debug(message: string): void;
    error(message: string): void;
    warn(message: string): void;
}

/**
 * Filter downloader interface for dependency injection
 */
export interface IFilterDownloader {
    download(source: string, options?: object, additionalOptions?: object): Promise<string[]>;
}

/**
 * Options for transformations that can be configured
 */
export interface ITransformationOptions {
    allowIp?: boolean;
}

/**
 * Context passed to transformations
 */
export interface ITransformationContext {
    configuration: IConfiguration | ISource;
    logger: ILogger;
}
