/**
 * Incremental Compilation Support
 * Only recompiles sources that have changed since the last compilation.
 */

import type { IConfiguration, ILogger, ISource } from '../types/index.ts';
import type { CompilationResult } from './FilterCompiler.ts';
import { FilterCompiler, FilterCompilerOptions } from './FilterCompiler.ts';
import { logger as defaultLogger } from '../utils/logger.ts';

/**
 * Cache entry for a compiled source
 */
export interface SourceCacheEntry {
    /** Source URL or path */
    source: string;
    /** Hash of the content */
    contentHash: string;
    /** Compiled rules */
    rules: string[];
    /** Compilation timestamp */
    timestamp: number;
    /** ETag from HTTP response (if applicable) */
    etag?: string;
    /** Last-Modified from HTTP response (if applicable) */
    lastModified?: string;
}

/**
 * Cache storage interface
 */
export interface ICacheStorage {
    /** Gets a cached entry */
    get(key: string): Promise<SourceCacheEntry | null>;
    /** Sets a cached entry */
    set(key: string, entry: SourceCacheEntry): Promise<void>;
    /** Deletes a cached entry */
    delete(key: string): Promise<void>;
    /** Clears all cached entries */
    clear(): Promise<void>;
    /** Lists all cached keys */
    keys(): Promise<string[]>;
}

/**
 * In-memory cache implementation
 */
export class MemoryCacheStorage implements ICacheStorage {
    private cache = new Map<string, SourceCacheEntry>();

    /**
     * Gets a cached entry by key
     * @param key - Cache key
     * @returns Cached entry or null if not found
     */
    async get(key: string): Promise<SourceCacheEntry | null> {
        return this.cache.get(key) ?? null;
    }

    /**
     * Sets a cached entry
     * @param key - Cache key
     * @param entry - Entry to cache
     */
    async set(key: string, entry: SourceCacheEntry): Promise<void> {
        this.cache.set(key, entry);
    }

    /**
     * Deletes a cached entry
     * @param key - Cache key to delete
     */
    async delete(key: string): Promise<void> {
        this.cache.delete(key);
    }

    /**
     * Clears all cached entries
     */
    async clear(): Promise<void> {
        this.cache.clear();
    }

    /**
     * Lists all cached keys
     * @returns Array of cache keys
     */
    async keys(): Promise<string[]> {
        return Array.from(this.cache.keys());
    }

    /** Gets current cache size */
    get size(): number {
        return this.cache.size;
    }
}

/**
 * Options for incremental compilation
 */
export interface IncrementalCompilerOptions extends FilterCompilerOptions {
    /** Cache storage implementation */
    cache?: ICacheStorage;
    /** Maximum age for cached entries in milliseconds */
    maxCacheAge?: number;
    /** Force refresh specific sources */
    forceRefresh?: string[];
    /** Whether to use conditional requests (If-None-Match, If-Modified-Since) */
    useConditionalRequests?: boolean;
}

/**
 * Result of incremental compilation
 */
export interface IncrementalCompilationResult extends CompilationResult {
    /** Sources that were recompiled */
    recompiledSources: string[];
    /** Sources that used cache */
    cachedSources: string[];
    /** Time saved by using cache (estimated) */
    timeSavedMs: number;
}

/**
 * Incremental compiler that caches source compilations
 */
export class IncrementalCompiler {
    private readonly compiler: FilterCompiler;
    private readonly cache: ICacheStorage;
    private readonly logger: ILogger;
    private readonly maxCacheAge: number;
    private readonly forceRefresh: Set<string>;

    /**
     * Creates a new IncrementalCompiler
     * @param options - Incremental compilation options
     */
    constructor(options?: IncrementalCompilerOptions) {
        this.logger = options?.logger ?? defaultLogger;
        this.cache = options?.cache ?? new MemoryCacheStorage();
        this.maxCacheAge = options?.maxCacheAge ?? 3600000; // 1 hour default
        this.forceRefresh = new Set(options?.forceRefresh ?? []);
        this.compiler = new FilterCompiler(options);
    }

    /**
     * Compiles a filter list with incremental compilation support
     */
    async compile(configuration: IConfiguration): Promise<string[]> {
        const result = await this.compileWithMetrics(configuration, false);
        return result.rules;
    }

    /**
     * Compiles with metrics and incremental compilation support
     */
    async compileWithMetrics(
        configuration: IConfiguration,
        benchmark = false,
    ): Promise<IncrementalCompilationResult> {
        const recompiledSources: string[] = [];
        const cachedSources: string[] = [];
        let estimatedTimeSaved = 0;

        this.logger.info('Starting incremental compilation');

        // Process each source
        const sourceResults: { source: ISource; rules: string[]; fromCache: boolean }[] = [];

        for (const source of configuration.sources) {
            const cacheKey = this.getCacheKey(source);
            const cached = await this.cache.get(cacheKey);

            // Check if we can use cached version
            if (cached && !this.shouldRecompile(source, cached)) {
                this.logger.debug(`Using cached version for: ${source.source}`);
                sourceResults.push({ source, rules: cached.rules, fromCache: true });
                cachedSources.push(source.source);
                estimatedTimeSaved += 500; // Rough estimate of time saved
                continue;
            }

            // Need to recompile this source
            this.logger.info(`Recompiling source: ${source.source}`);
            recompiledSources.push(source.source);

            try {
                const rules = await this.compileSource(source);
                const contentHash = await this.hashContent(rules);

                // Cache the result
                await this.cache.set(cacheKey, {
                    source: source.source,
                    contentHash,
                    rules,
                    timestamp: Date.now(),
                });

                sourceResults.push({ source, rules, fromCache: false });
            } catch (error) {
                this.logger.error(`Failed to compile source ${source.source}: ${error}`);

                // If we have a cached version, use it as fallback
                if (cached) {
                    this.logger.warn(`Using stale cache for ${source.source}`);
                    sourceResults.push({ source, rules: cached.rules, fromCache: true });
                    cachedSources.push(source.source);
                } else {
                    throw error;
                }
            }
        }

        // Combine all rules
        let allRules: string[] = [];
        for (const { rules } of sourceResults) {
            allRules = allRules.concat(rules);
        }

        // Apply transformations and generate final output
        const result = await this.compiler.compileWithMetrics(
            {
                ...configuration,
                // Override sources to use pre-compiled rules
                sources: sourceResults.map((sr) => ({
                    ...sr.source,
                    _precompiled: sr.rules,
                })) as ISource[],
            },
            benchmark,
        );

        this.logger.info(
            `Incremental compilation complete: ` +
                `${recompiledSources.length} recompiled, ${cachedSources.length} from cache, ` +
                `~${estimatedTimeSaved}ms saved`,
        );

        return {
            ...result,
            recompiledSources,
            cachedSources,
            timeSavedMs: estimatedTimeSaved,
        };
    }

    /**
     * Generates cache key for a source
     */
    private getCacheKey(source: ISource): string {
        const transformations = source.transformations?.join(',') ?? '';
        return `source:${source.source}:${source.type ?? 'adblock'}:${transformations}`;
    }

    /**
     * Determines if a source should be recompiled
     */
    private shouldRecompile(source: ISource, cached: SourceCacheEntry): boolean {
        // Force refresh if requested
        if (this.forceRefresh.has(source.source)) {
            return true;
        }

        // Check cache age
        const age = Date.now() - cached.timestamp;
        if (age > this.maxCacheAge) {
            this.logger.debug(`Cache expired for ${source.source} (age: ${age}ms)`);
            return true;
        }

        return false;
    }

    /**
     * Compiles a single source
     */
    private async compileSource(source: ISource): Promise<string[]> {
        // Use the FilterDownloader to get content
        const { FilterDownloader } = await import('../downloader/FilterDownloader.ts');
        const downloader = new FilterDownloader();
        return downloader.download(source.source);
    }

    /**
     * Hashes content for comparison
     */
    private async hashContent(rules: string[]): Promise<string> {
        const content = rules.join('\n');
        const encoder = new TextEncoder();
        const data = encoder.encode(content);

        try {
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        } catch {
            // Fallback for environments without crypto.subtle
            let hash = 0;
            for (let i = 0; i < content.length; i++) {
                const char = content.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(16);
        }
    }

    /**
     * Clears the compilation cache
     */
    async clearCache(): Promise<void> {
        await this.cache.clear();
        this.logger.info('Compilation cache cleared');
    }

    /**
     * Gets cache statistics
     */
    async getCacheStats(): Promise<{
        entries: number;
        sources: string[];
        totalRules: number;
        oldestEntry: number;
        newestEntry: number;
    }> {
        const keys = await this.cache.keys();
        const entries: SourceCacheEntry[] = [];

        for (const key of keys) {
            const entry = await this.cache.get(key);
            if (entry) {
                entries.push(entry);
            }
        }

        return {
            entries: entries.length,
            sources: entries.map((e) => e.source),
            totalRules: entries.reduce((sum, e) => sum + e.rules.length, 0),
            oldestEntry: entries.length > 0 ? Math.min(...entries.map((e) => e.timestamp)) : 0,
            newestEntry: entries.length > 0 ? Math.max(...entries.map((e) => e.timestamp)) : 0,
        };
    }
}
