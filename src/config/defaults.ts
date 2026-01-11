/**
 * Centralized configuration defaults and constants.
 * All magic numbers and default values should be defined here.
 */

/**
 * Network-related default configuration
 */
export const NETWORK_DEFAULTS = {
    /** Maximum number of redirects to follow */
    MAX_REDIRECTS: 5,
    /** Request timeout in milliseconds */
    TIMEOUT_MS: 30_000,
    /** Maximum number of retry attempts */
    MAX_RETRIES: 3,
    /** Base delay for retry backoff in milliseconds */
    RETRY_DELAY_MS: 1_000,
    /** Maximum jitter percentage for retry backoff */
    RETRY_JITTER_PERCENT: 0.3,
} as const;

/**
 * Preprocessor-related defaults
 */
export const PREPROCESSOR_DEFAULTS = {
    /** Maximum depth for !#include directives */
    MAX_INCLUDE_DEPTH: 10,
} as const;

/**
 * Worker/API-related defaults
 */
export const WORKER_DEFAULTS = {
    /** Rate limit window in seconds */
    RATE_LIMIT_WINDOW_SECONDS: 60,
    /** Maximum requests per rate limit window */
    RATE_LIMIT_MAX_REQUESTS: 10,
    /** Cache TTL in seconds */
    CACHE_TTL_SECONDS: 3600,
    /** Metrics aggregation window in seconds */
    METRICS_WINDOW_SECONDS: 300,
    /** Maximum batch requests allowed */
    MAX_BATCH_REQUESTS: 10,
} as const;

/**
 * Storage-related defaults
 */
export const STORAGE_DEFAULTS = {
    /** Default cache TTL in milliseconds */
    CACHE_TTL_MS: 3600_000, // 1 hour
    /** Maximum entries to keep in memory cache */
    MAX_MEMORY_CACHE_ENTRIES: 100,
} as const;

/**
 * Compilation-related defaults
 */
export const COMPILATION_DEFAULTS = {
    /** Default source type when not specified */
    DEFAULT_SOURCE_TYPE: 'adblock' as const,
    /** Maximum concurrent source downloads */
    MAX_CONCURRENT_DOWNLOADS: 10,
    /** Chunk size for streaming operations */
    STREAM_CHUNK_SIZE: 1000,
} as const;

/**
 * Validation-related defaults
 */
export const VALIDATION_DEFAULTS = {
    /** Maximum rule length in characters */
    MAX_RULE_LENGTH: 10_000,
    /** Maximum configuration name length */
    MAX_NAME_LENGTH: 256,
    /** Maximum number of sources per configuration */
    MAX_SOURCES: 100,
    /** Maximum number of exclusion patterns */
    MAX_EXCLUSIONS: 10_000,
} as const;

/**
 * Output format options
 */
export enum OutputFormat {
    /** AdBlock Plus compatible format (default) */
    Adblock = 'adblock',
    /** /etc/hosts file format */
    Hosts = 'hosts',
    /** dnsmasq configuration format */
    Dnsmasq = 'dnsmasq',
    /** Pi-hole compatible format */
    PiHole = 'pihole',
    /** JSON format for programmatic access */
    JSON = 'json',
    /** DNS-over-HTTPS blocklist format */
    DoH = 'doh',
    /** Unbound DNS resolver format */
    Unbound = 'unbound',
}

/**
 * Rule types for statistics
 */
export enum RuleType {
    /** Domain blocking rule */
    Domain = 'domain',
    /** Subdomain wildcard rule */
    Subdomain = 'subdomain',
    /** Regular expression rule */
    Regex = 'regex',
    /** Cosmetic/element hiding rule */
    Cosmetic = 'cosmetic',
    /** Exception/allow rule */
    Exception = 'exception',
    /** Comment line */
    Comment = 'comment',
    /** Unknown/other rule type */
    Unknown = 'unknown',
}

/**
 * Health status levels
 */
export enum HealthStatus {
    /** Source is healthy and responsive */
    Healthy = 'healthy',
    /** Source has intermittent issues */
    Degraded = 'degraded',
    /** Source is unavailable */
    Unhealthy = 'unhealthy',
    /** Source status is unknown */
    Unknown = 'unknown',
}

/**
 * All defaults combined for easy access
 */
export const DEFAULTS = {
    network: NETWORK_DEFAULTS,
    preprocessor: PREPROCESSOR_DEFAULTS,
    worker: WORKER_DEFAULTS,
    storage: STORAGE_DEFAULTS,
    compilation: COMPILATION_DEFAULTS,
    validation: VALIDATION_DEFAULTS,
} as const;
