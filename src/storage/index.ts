/**
 * Storage module exports
 */

// Core storage types
export type { CacheEntry, CompilationMetadata, QueryOptions, StorageEntry, StorageStats } from './types.ts';

// Health monitoring
export { HealthStatus, type SourceAttempt, type SourceHealthMetrics, SourceHealthMonitor } from './SourceHealthMonitor.ts';

// Change detection
export { type ChangeDetectionResult, ChangeDetector, type ChangeSummary, type SourceSnapshot } from './ChangeDetector.ts';

// Caching downloader
export { CachingDownloader, type CachingOptions, type DownloadResult } from './CachingDownloader.ts';

// Storage abstraction layer
export type { IStorageAdapter, StorageAdapterConfig, StorageAdapterFactory, StorageAdapterType } from './IStorageAdapter.ts';

// Prisma storage adapter (default, uses SQLite)
export { PrismaStorageAdapter } from './PrismaStorageAdapter.ts';

// Cloudflare D1 storage adapter (for edge deployments)
export { createD1Storage, D1StorageAdapter, type D1StorageConfig } from './D1StorageAdapter.ts';
