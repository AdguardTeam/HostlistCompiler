/**
 * Storage Types Module
 *
 * Common types used across storage adapters.
 */

/**
 * Storage entry with metadata
 */
export interface StorageEntry<T = unknown> {
    /** The stored data */
    data: T;
    /** Timestamp when the entry was created */
    createdAt: number;
    /** Timestamp when the entry was last updated */
    updatedAt: number;
    /** Optional expiration timestamp */
    expiresAt?: number;
    /** Optional tags for categorization */
    tags?: string[];
}

/**
 * Query options for listing entries
 */
export interface QueryOptions {
    /** Prefix to filter keys */
    prefix?: string[];
    /** Limit number of results */
    limit?: number;
    /** Start from a specific key */
    start?: string[];
    /** End at a specific key */
    end?: string[];
    /** Reverse the order */
    reverse?: boolean;
}

/**
 * Storage statistics
 */
export interface StorageStats {
    /** Total number of entries */
    entryCount: number;
    /** Number of expired entries */
    expiredCount: number;
    /** Storage size estimate in bytes */
    sizeEstimate: number;
}

/**
 * Cache entry for filter list downloads
 */
export interface CacheEntry {
    /** Source URL or path */
    source: string;
    /** Content of the filter list */
    content: string[];
    /** ETag or version identifier */
    etag?: string;
    /** Content hash for validation */
    hash: string;
}

/**
 * Compilation metadata
 */
export interface CompilationMetadata {
    /** Configuration name */
    configName: string;
    /** Timestamp of compilation */
    timestamp: number;
    /** Number of sources compiled */
    sourceCount: number;
    /** Total number of rules */
    ruleCount: number;
    /** Duration in milliseconds */
    duration: number;
    /** Output file path */
    outputPath?: string;
}
