/**
 * Storage module exports
 */

// Core NoSQL storage (Deno KV backend)
export { type CacheEntry, type CompilationMetadata, NoSqlStorage, type QueryOptions, type StorageEntry, type StorageStats } from './NoSqlStorage.ts';

// Health monitoring
export { HealthStatus, type SourceAttempt, type SourceHealthMetrics, SourceHealthMonitor } from './SourceHealthMonitor.ts';

// Change detection
export { type ChangeDetectionResult, ChangeDetector, type ChangeSummary, type SourceSnapshot } from './ChangeDetector.ts';

// Caching downloader
export { CachingDownloader, type CachingOptions, type DownloadResult } from './CachingDownloader.ts';

// Storage abstraction layer
export type { IStorageAdapter, StorageAdapterConfig, StorageAdapterFactory, StorageAdapterType } from './IStorageAdapter.ts';

// Prisma storage adapter (optional, requires @prisma/client)
export { PrismaStorageAdapter } from './PrismaStorageAdapter.ts';
