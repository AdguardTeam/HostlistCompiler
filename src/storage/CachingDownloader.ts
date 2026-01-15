import type { IDetailedLogger, IDownloader } from '../types/index.ts';
import type { IStorageAdapter } from './IStorageAdapter.ts';
import { ChangeDetector } from './ChangeDetector.ts';
import { SourceHealthMonitor } from './SourceHealthMonitor.ts';

/**
 * Caching options
 */
export interface CachingOptions {
    /** Enable caching */
    enabled: boolean;
    /** Cache TTL in milliseconds (default: 1 hour) */
    ttl?: number;
    /** Enable change detection */
    detectChanges?: boolean;
    /** Enable health monitoring */
    monitorHealth?: boolean;
    /** Force refresh even if cached */
    forceRefresh?: boolean;
}

/**
 * Download result with metadata
 */
export interface DownloadResult {
    /** Downloaded content */
    content: string[];
    /** Whether content came from cache */
    fromCache: boolean;
    /** Content hash */
    hash: string;
    /** Download duration in milliseconds */
    duration: number;
    /** Whether content changed from previous */
    hasChanged?: boolean;
    /** Rule count delta if changed */
    ruleCountDelta?: number;
}

/**
 * Intelligent caching downloader with health monitoring and change detection
 */
export class CachingDownloader implements IDownloader {
    private readonly downloader: IDownloader;
    private readonly storage: IStorageAdapter;
    private readonly logger: IDetailedLogger;
    private readonly changeDetector: ChangeDetector;
    private readonly healthMonitor: SourceHealthMonitor;
    private readonly options: Required<CachingOptions>;

    constructor(
        downloader: IDownloader,
        storage: IStorageAdapter,
        logger: IDetailedLogger,
        options?: CachingOptions,
    ) {
        this.downloader = downloader;
        this.storage = storage;
        this.logger = logger;
        this.changeDetector = new ChangeDetector(storage, logger);
        this.healthMonitor = new SourceHealthMonitor(storage, logger);

        this.options = {
            enabled: options?.enabled ?? true,
            ttl: options?.ttl ?? 3600000, // 1 hour default
            detectChanges: options?.detectChanges ?? true,
            monitorHealth: options?.monitorHealth ?? true,
            forceRefresh: options?.forceRefresh ?? false,
        };
    }

    /**
     * Downloads content with intelligent caching
     */
    async download(source: string): Promise<string[]> {
        const result = await this.downloadWithMetadata(source);
        return result.content;
    }

    /**
     * Downloads content with full metadata
     */
    async downloadWithMetadata(source: string): Promise<DownloadResult> {
        const startTime = Date.now();

        try {
            // Check cache first (if enabled and not forcing refresh)
            if (this.options.enabled && !this.options.forceRefresh) {
                const cached = await this.storage.getCachedFilterList(source);
                if (cached) {
                    this.logger.info(`Using cached content for ${source}`);

                    // Do not record health metrics for cache hits to avoid skewing source latency.

                    return {
                        content: cached.content,
                        fromCache: true,
                        hash: cached.hash,
                        duration: Date.now() - startTime,
                    };
                }
            }

            // Download fresh content
            this.logger.info(`Downloading ${source}...`);
            const content = await this.downloader.download(source);
            const duration = Date.now() - startTime;
            const hash = await this.hashContent(content);

            // Cache the content
            if (this.options.enabled) {
                await this.storage.cacheFilterList(
                    source,
                    content,
                    hash,
                    undefined,
                    this.options.ttl,
                );
            }

            // Detect changes
            let hasChanged = false;
            let ruleCountDelta = 0;
            if (this.options.detectChanges) {
                const changeResult = await this.changeDetector.detectAndStore(
                    source,
                    content,
                    hash,
                );
                hasChanged = changeResult.hasChanged;
                ruleCountDelta = changeResult.ruleCountDelta;

                // Archive significant changes
                if (hasChanged && Math.abs(ruleCountDelta) > 100) {
                    await this.changeDetector.archiveSnapshot(changeResult.current);
                }
            }

            // Record health
            if (this.options.monitorHealth) {
                await this.healthMonitor.recordAttempt(source, true, duration, {
                    ruleCount: content.length,
                });
            }

            return {
                content,
                fromCache: false,
                hash,
                duration,
                hasChanged,
                ruleCountDelta,
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);

            // Record failure
            if (this.options.monitorHealth) {
                await this.healthMonitor.recordAttempt(source, false, duration, {
                    error: errorMessage,
                });
            }

            this.logger.error(`Failed to download ${source}: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Checks if source is cached and valid
     */
    async isCached(source: string): Promise<boolean> {
        const cached = await this.storage.getCachedFilterList(source);
        return cached !== null;
    }

    /**
     * Invalidates cache for a source
     */
    async invalidateCache(source: string): Promise<void> {
        await this.storage.delete(['cache', 'filters', source]);
        this.logger.info(`Invalidated cache for ${source}`);
    }

    /**
     * Gets health metrics for a source
     */
    async getSourceHealth(source: string) {
        return await this.healthMonitor.getHealthMetrics(source);
    }

    /**
     * Gets all unhealthy sources
     */
    async getUnhealthySources() {
        return await this.healthMonitor.getUnhealthySources();
    }

    /**
     * Generates health report
     */
    async generateHealthReport(): Promise<string> {
        return await this.healthMonitor.generateHealthReport();
    }

    /**
     * Gets last snapshot for a source
     */
    async getLastSnapshot(source: string) {
        return await this.changeDetector.getLastSnapshot(source);
    }

    /**
     * Gets change history for a source
     */
    async getChangeHistory(source: string, limit?: number) {
        return await this.changeDetector.getSnapshotHistory(source, limit);
    }

    /**
     * Pre-warms cache by downloading and caching sources
     */
    async prewarmCache(sources: string[]): Promise<{
        successful: number;
        failed: number;
        errors: Array<{ source: string; error: string }>;
    }> {
        this.logger.info(`Pre-warming cache for ${sources.length} sources...`);

        let successful = 0;
        let failed = 0;
        const errors: Array<{ source: string; error: string }> = [];

        for (const source of sources) {
            try {
                await this.downloadWithMetadata(source);
                successful++;
            } catch (error) {
                failed++;
                errors.push({
                    source,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        this.logger.info(
            `Cache pre-warming complete: ${successful} successful, ${failed} failed`,
        );

        return { successful, failed, errors };
    }

    /**
     * Generates a simple hash of content
     */
    private async hashContent(content: string[]): Promise<string> {
        const text = content.join('\n');
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    /**
     * Gets cache statistics
     */
    async getCacheStats(): Promise<{
        totalCached: number;
        totalSize: number;
        oldestCache?: number;
        newestCache?: number;
    }> {
        const entries = await this.storage.list({
            prefix: ['cache', 'filters'],
        });

        let totalSize = 0;
        let oldestCache: number | undefined;
        let newestCache: number | undefined;

        for (const entry of entries) {
            const created = entry.value.createdAt;

            if (!oldestCache || created < oldestCache) {
                oldestCache = created;
            }
            if (!newestCache || created > newestCache) {
                newestCache = created;
            }

            // Estimate size
            totalSize += JSON.stringify(entry.value).length;
        }

        return {
            totalCached: entries.length,
            totalSize,
            oldestCache,
            newestCache,
        };
    }
}
