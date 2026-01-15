/**
 * Prisma Storage Adapter
 *
 * Storage backend implementation using Prisma ORM.
 * Supports SQLite, PostgreSQL, and MongoDB databases.
 *
 * Note: This adapter requires @prisma/client to be installed and
 * prisma generate to be run before use.
 *
 * Installation:
 *   npm install @prisma/client
 *   npx prisma generate
 *   npx prisma db push (or npx prisma migrate dev)
 */

import type { IDetailedLogger } from '../types/index.ts';
import type { IStorageAdapter, StorageAdapterConfig } from './IStorageAdapter.ts';
import type { CacheEntry, CompilationMetadata, QueryOptions, StorageEntry, StorageStats } from './types.ts';

/**
 * Default SQLite database URL
 * Creates the database in ./data/adblock.db relative to the project root
 */
const DEFAULT_DATABASE_URL = 'file:./data/adblock.db';

/**
 * Type for Prisma Client - using any to avoid direct dependency
 * In production, this would be: import { PrismaClient } from '@prisma/client'
 */
// deno-lint-ignore no-explicit-any
type PrismaClientType = any;

/**
 * Serializes a key array to a string for Prisma storage
 */
function serializeKey(key: string[]): string {
    return key.join('/');
}

/**
 * Deserializes a key string back to an array
 */
function deserializeKey(key: string): string[] {
    return key.split('/');
}

/**
 * Prisma-based storage adapter implementation
 *
 * Default storage backend using Prisma ORM with SQLite.
 * Supports SQLite, PostgreSQL, MySQL, and MongoDB.
 */
export class PrismaStorageAdapter implements IStorageAdapter {
    private prisma: PrismaClientType | null = null;
    private readonly logger: IDetailedLogger;
    private readonly config: StorageAdapterConfig;
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;
    private _isOpen = false;

    /**
     * Creates a new PrismaStorageAdapter instance
     * @param logger - Logger for diagnostic messages
     * @param config - Storage adapter configuration
     */
    constructor(logger: IDetailedLogger, config: StorageAdapterConfig = { type: 'prisma' }) {
        this.logger = logger;
        this.config = {
            defaultTtlMs: 3600000, // 1 hour default
            autoCleanup: true,
            cleanupIntervalMs: 300000, // 5 minutes
            ...config,
        };
    }

    /**
     * Opens the Prisma client connection
     */
    async open(): Promise<void> {
        if (this._isOpen) {
            this.logger.warn('Prisma storage already open');
            return;
        }

        try {
            // Dynamic import to avoid hard dependency
            // In production: import { PrismaClient } from '@prisma/client'
            const { PrismaClient } = await import('@prisma/client');

            // Use config connectionString, env var, or default
            const databaseUrl = this.config.connectionString ||
                (typeof Deno !== 'undefined' ? Deno.env.get('DATABASE_URL') : undefined) ||
                (typeof process !== 'undefined' ? process.env?.DATABASE_URL : undefined) ||
                DEFAULT_DATABASE_URL;

            this.prisma = new PrismaClient({
                datasources: {
                    db: {
                        url: databaseUrl,
                    },
                },
            });

            this.logger.debug(`Using database: ${databaseUrl}`);

            await this.prisma.$connect();
            this._isOpen = true;
            this.logger.info('Prisma storage opened');

            // Start auto-cleanup if enabled
            if (this.config.autoCleanup) {
                this.startAutoCleanup();
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to open Prisma storage: ${message}`);
            throw new Error(`Prisma storage initialization failed: ${message}`);
        }
    }

    /**
     * Closes the Prisma client connection
     */
    async close(): Promise<void> {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        if (this.prisma) {
            await this.prisma.$disconnect();
            this.prisma = null;
            this._isOpen = false;
            this.logger.info('Prisma storage closed');
        }
    }

    /**
     * Checks if the storage is open
     */
    isOpen(): boolean {
        return this._isOpen;
    }

    /**
     * Ensures the Prisma client is connected
     */
    private ensureOpen(): PrismaClientType {
        if (!this.prisma || !this._isOpen) {
            throw new Error('Storage not initialized. Call open() first.');
        }
        return this.prisma;
    }

    /**
     * Starts the auto-cleanup interval
     */
    private startAutoCleanup(): void {
        if (this.cleanupInterval) return;

        this.cleanupInterval = setInterval(async () => {
            try {
                const count = await this.clearExpired();
                if (count > 0) {
                    this.logger.debug(`Auto-cleanup removed ${count} expired entries`);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.warn(`Auto-cleanup failed: ${message}`);
            }
        }, this.config.cleanupIntervalMs);
    }

    // ========================================================================
    // Core Key-Value Operations
    // ========================================================================

    /**
     * Stores a value with the given key
     */
    async set<T>(key: string[], value: T, ttlMs?: number): Promise<boolean> {
        const prisma = this.ensureOpen();
        const serializedKey = serializeKey(key);

        const entry: StorageEntry<T> = {
            data: value,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
        };

        try {
            await prisma.storageEntry.upsert({
                where: { key: serializedKey },
                update: {
                    data: JSON.stringify(entry.data),
                    updatedAt: new Date(),
                    expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : null,
                },
                create: {
                    key: serializedKey,
                    data: JSON.stringify(entry.data),
                    createdAt: new Date(),
                    expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : null,
                },
            });

            this.logger.debug(`Stored entry at key: ${serializedKey}`);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to set key ${serializedKey}: ${message}`);
            return false;
        }
    }

    /**
     * Retrieves a value by key
     */
    async get<T>(key: string[]): Promise<StorageEntry<T> | null> {
        const prisma = this.ensureOpen();
        const serializedKey = serializeKey(key);

        try {
            const result = await prisma.storageEntry.findUnique({
                where: { key: serializedKey },
            });

            if (!result) {
                return null;
            }

            // Check if expired
            if (result.expiresAt && result.expiresAt < new Date()) {
                this.logger.debug(`Entry at key ${serializedKey} has expired`);
                await this.delete(key);
                return null;
            }

            const entry: StorageEntry<T> = {
                data: JSON.parse(result.data),
                createdAt: result.createdAt.getTime(),
                updatedAt: result.updatedAt.getTime(),
                expiresAt: result.expiresAt?.getTime(),
                tags: result.tags ? JSON.parse(result.tags) : undefined,
            };

            this.logger.debug(`Retrieved entry at key: ${serializedKey}`);
            return entry;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to get key ${serializedKey}: ${message}`);
            return null;
        }
    }

    /**
     * Deletes a value by key
     */
    async delete(key: string[]): Promise<boolean> {
        const prisma = this.ensureOpen();
        const serializedKey = serializeKey(key);

        try {
            await prisma.storageEntry.delete({
                where: { key: serializedKey },
            });
            this.logger.debug(`Deleted entry at key: ${serializedKey}`);
            return true;
        } catch (error) {
            // Record not found is not an error for delete
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes('Record to delete does not exist')) {
                return true;
            }
            this.logger.error(`Failed to delete key ${serializedKey}: ${message}`);
            return false;
        }
    }

    /**
     * Lists entries matching the query options
     */
    async list<T>(options: QueryOptions = {}): Promise<Array<{ key: string[]; value: StorageEntry<T> }>> {
        const prisma = this.ensureOpen();
        const results: Array<{ key: string[]; value: StorageEntry<T> }> = [];

        try {
            const whereClause: Record<string, unknown> = {};

            // Handle prefix filter
            if (options.prefix) {
                const prefixStr = serializeKey(options.prefix);
                whereClause.key = { startsWith: prefixStr };
            }

            // Handle start/end range
            if (options.start) {
                whereClause.key = {
                    ...((whereClause.key as object) || {}),
                    gte: serializeKey(options.start),
                };
            }
            if (options.end) {
                whereClause.key = {
                    ...((whereClause.key as object) || {}),
                    lte: serializeKey(options.end),
                };
            }

            // Exclude expired entries
            whereClause.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];

            const entries = await prisma.storageEntry.findMany({
                where: whereClause,
                orderBy: { key: options.reverse ? 'desc' : 'asc' },
                take: options.limit,
            });

            for (const entry of entries) {
                const storageEntry: StorageEntry<T> = {
                    data: JSON.parse(entry.data),
                    createdAt: entry.createdAt.getTime(),
                    updatedAt: entry.updatedAt.getTime(),
                    expiresAt: entry.expiresAt?.getTime(),
                    tags: entry.tags ? JSON.parse(entry.tags) : undefined,
                };

                results.push({
                    key: deserializeKey(entry.key),
                    value: storageEntry,
                });
            }

            this.logger.debug(`Listed ${results.length} entries`);
            return results;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to list entries: ${message}`);
            return [];
        }
    }

    /**
     * Clears all expired entries
     */
    async clearExpired(): Promise<number> {
        const prisma = this.ensureOpen();

        try {
            const result = await prisma.storageEntry.deleteMany({
                where: {
                    expiresAt: {
                        lt: new Date(),
                        not: null,
                    },
                },
            });

            // Also clean up expired filter cache entries
            await prisma.filterCache.deleteMany({
                where: {
                    expiresAt: {
                        lt: new Date(),
                        not: null,
                    },
                },
            });

            this.logger.info(`Cleared ${result.count} expired entries`);
            return result.count;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to clear expired entries: ${message}`);
            return 0;
        }
    }

    /**
     * Gets storage statistics
     */
    async getStats(): Promise<StorageStats> {
        const prisma = this.ensureOpen();

        try {
            const [totalCount, expiredCount, entries] = await Promise.all([
                prisma.storageEntry.count(),
                prisma.storageEntry.count({
                    where: {
                        expiresAt: {
                            lt: new Date(),
                            not: null,
                        },
                    },
                }),
                prisma.storageEntry.findMany({
                    select: { data: true },
                }),
            ]);

            // Estimate size
            let sizeEstimate = 0;
            for (const entry of entries) {
                sizeEstimate += entry.data.length;
            }

            return {
                entryCount: totalCount,
                expiredCount,
                sizeEstimate,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to get stats: ${message}`);
            return { entryCount: 0, expiredCount: 0, sizeEstimate: 0 };
        }
    }

    // ========================================================================
    // Convenience Methods for Filter List Caching
    // ========================================================================

    /**
     * Stores a cache entry for a filter list download
     */
    async cacheFilterList(
        source: string,
        content: string[],
        hash: string,
        etag?: string,
        ttlMs: number = this.config.defaultTtlMs || 3600000,
    ): Promise<boolean> {
        const prisma = this.ensureOpen();

        try {
            await prisma.filterCache.upsert({
                where: { source },
                update: {
                    content: JSON.stringify(content),
                    hash,
                    etag,
                    updatedAt: new Date(),
                    expiresAt: new Date(Date.now() + ttlMs),
                },
                create: {
                    source,
                    content: JSON.stringify(content),
                    hash,
                    etag,
                    expiresAt: new Date(Date.now() + ttlMs),
                },
            });

            this.logger.debug(`Cached filter list for source: ${source}`);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to cache filter list: ${message}`);
            return false;
        }
    }

    /**
     * Retrieves a cached filter list
     */
    async getCachedFilterList(source: string): Promise<CacheEntry | null> {
        const prisma = this.ensureOpen();

        try {
            const result = await prisma.filterCache.findUnique({
                where: { source },
            });

            if (!result) {
                return null;
            }

            // Check if expired
            if (result.expiresAt && result.expiresAt < new Date()) {
                this.logger.debug(`Filter cache for ${source} has expired`);
                await prisma.filterCache.delete({ where: { source } });
                return null;
            }

            return {
                source: result.source,
                content: JSON.parse(result.content),
                hash: result.hash,
                etag: result.etag || undefined,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to get cached filter list: ${message}`);
            return null;
        }
    }

    /**
     * Stores compilation metadata
     */
    async storeCompilationMetadata(metadata: CompilationMetadata): Promise<boolean> {
        const prisma = this.ensureOpen();

        try {
            await prisma.compilationMetadata.create({
                data: {
                    configName: metadata.configName,
                    timestamp: new Date(metadata.timestamp),
                    sourceCount: metadata.sourceCount,
                    ruleCount: metadata.ruleCount,
                    duration: metadata.duration,
                    outputPath: metadata.outputPath,
                },
            });

            this.logger.debug(`Stored compilation metadata for: ${metadata.configName}`);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to store compilation metadata: ${message}`);
            return false;
        }
    }

    /**
     * Retrieves recent compilation metadata
     */
    async getCompilationHistory(configName: string, limit: number = 10): Promise<CompilationMetadata[]> {
        const prisma = this.ensureOpen();

        try {
            const results = await prisma.compilationMetadata.findMany({
                where: { configName },
                orderBy: { timestamp: 'desc' },
                take: limit,
            });

            return results.map(
                (r: {
                    configName: string;
                    timestamp: Date;
                    sourceCount: number;
                    ruleCount: number;
                    duration: number;
                    outputPath: string | null;
                }) => ({
                    configName: r.configName,
                    timestamp: r.timestamp.getTime(),
                    sourceCount: r.sourceCount,
                    ruleCount: r.ruleCount,
                    duration: r.duration,
                    outputPath: r.outputPath || undefined,
                }),
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to get compilation history: ${message}`);
            return [];
        }
    }

    /**
     * Clears all cache entries
     */
    async clearCache(): Promise<number> {
        const prisma = this.ensureOpen();

        try {
            // Clear both generic cache entries and filter cache
            const [storageResult, filterResult] = await Promise.all([
                prisma.storageEntry.deleteMany({
                    where: {
                        key: { startsWith: 'cache/' },
                    },
                }),
                prisma.filterCache.deleteMany({}),
            ]);

            const totalCount = storageResult.count + filterResult.count;
            this.logger.info(`Cleared ${totalCount} cache entries`);
            return totalCount;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to clear cache: ${message}`);
            return 0;
        }
    }
}
