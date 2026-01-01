# Advanced Storage Features

This document covers the advanced features built on top of the NoSQL storage backend.

## Table of Contents

- [Intelligent Caching](#intelligent-caching)
- [Source Health Monitoring](#source-health-monitoring)
- [Change Detection](#change-detection)
- [Complete Integration Example](#complete-integration-example)
- [Best Practices](#best-practices)

## Intelligent Caching

The `CachingDownloader` wraps any downloader implementation with intelligent caching, health monitoring, and change detection.

### Basic Usage

```typescript
import { NoSqlStorage, CachingDownloader } from './storage/index.ts';
import { FilterDownloader } from './downloader/FilterDownloader.ts';
import { logger } from './utils/logger.ts';

// Initialize storage
const storage = new NoSqlStorage(logger);
await storage.open();

// Wrap your downloader
const baseDownloader = new FilterDownloader();
const cachingDownloader = new CachingDownloader(
    baseDownloader,
    storage,
    logger,
    {
        enabled: true,
        ttl: 3600000, // 1 hour cache
        detectChanges: true,
        monitorHealth: true,
        forceRefresh: false,
    }
);

// Use it like any downloader
const rules = await cachingDownloader.download('https://example.com/filters.txt');
```

### Features

#### Cache with TTL
- Automatically caches downloads
- Configurable TTL (time-to-live)
- Reduces network requests and compilation time

#### Force Refresh
```typescript
// Bypass cache and force fresh download
const freshDownloader = new CachingDownloader(
    baseDownloader,
    storage,
    logger,
    { forceRefresh: true }
);
```

#### Download with Metadata
```typescript
const result = await cachingDownloader.downloadWithMetadata(source);
console.log(`From cache: ${result.fromCache}`);
console.log(`Rules: ${result.content.length}`);
console.log(`Changed: ${result.hasChanged}`);
console.log(`Delta: ${result.ruleCountDelta} rules`);
```

#### Pre-warming Cache
```typescript
const sources = [
    'https://easylist.to/easylist/easylist.txt',
    'https://easylist.to/easylist/easyprivacy.txt',
];

const result = await cachingDownloader.prewarmCache(sources);
console.log(`${result.successful}/${sources.length} cached`);
```

#### Cache Management
```typescript
// Check if cached
const isCached = await cachingDownloader.isCached(source);

// Invalidate specific source
await cachingDownloader.invalidateCache(source);

// Get cache statistics
const stats = await cachingDownloader.getCacheStats();
console.log(`Cached: ${stats.totalCached} sources`);
console.log(`Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
```

## Source Health Monitoring

The `SourceHealthMonitor` tracks the reliability of filter list sources over time.

### Automatic Monitoring

When using `CachingDownloader` with `monitorHealth: true`, all downloads are automatically tracked.

### Health Status

Sources are classified as:
- **Healthy**: 95%+ success rate, no recent failures
- **Degraded**: 80-95% success rate or 1-2 consecutive failures
- **Unhealthy**: <80% success rate or 3+ consecutive failures
- **Unknown**: No data yet

### Usage

```typescript
// Get health for specific source
const health = await cachingDownloader.getSourceHealth(source);
console.log(`Status: ${health.status}`);
console.log(`Success rate: ${(health.successRate * 100).toFixed(1)}%`);
console.log(`Average duration: ${health.averageDuration}ms`);
console.log(`Consecutive failures: ${health.consecutiveFailures}`);

// Get all unhealthy sources
const unhealthy = await cachingDownloader.getUnhealthySources();
for (const source of unhealthy) {
    console.log(`⚠️  ${source.source} is ${source.status}`);
}

// Generate full health report
const report = await cachingDownloader.generateHealthReport();
console.log(report);
```

### Health Report Example

```
Source Health Report
==================================================

Total Sources: 5
Healthy: 3
Degraded: 1
Unhealthy: 1

Unhealthy Sources:
  - https://dead-source.com/filters.txt
    Success Rate: 0.0%
    Consecutive Failures: 5
    Last Failure: 2 minutes ago

Degraded Sources:
  - https://slow-source.com/filters.txt
    Success Rate: 85.0%
    Consecutive Failures: 1
```

### Metrics Tracked

- Total attempts
- Success/failure counts
- Success rate
- Average download duration
- Recent attempts (last 10)
- Consecutive failures
- Last success/failure timestamps
- Average rule count

## Change Detection

The `ChangeDetector` tracks changes in filter lists over time.

### Automatic Detection

When using `CachingDownloader` with `detectChanges: true`, changes are automatically detected and logged.

### Usage

```typescript
// Get last snapshot
const snapshot = await cachingDownloader.getLastSnapshot(source);
if (snapshot) {
    console.log(`Last seen: ${new Date(snapshot.timestamp)}`);
    console.log(`Rules: ${snapshot.ruleCount}`);
    console.log(`Hash: ${snapshot.hash}`);
}

// Get change history
const history = await cachingDownloader.getChangeHistory(source, 10);
for (const snap of history) {
    console.log(`${new Date(snap.timestamp)}: ${snap.ruleCount} rules`);
}
```

### Manual Detection

```typescript
import { ChangeDetector } from './storage/index.ts';

const detector = new ChangeDetector(storage, logger);

// Detect changes
const result = await detector.detectAndStore(source, content, hash);

if (result.hasChanged) {
    console.log(`Changed by ${result.ruleCountDelta} rules`);
    console.log(`${result.ruleCountChangePercent.toFixed(1)}% change`);
}

// Generate change summary
const results = [/* multiple change detection results */];
const summary = await detector.generateChangeSummary(results);
console.log(`${summary.changedSources}/${summary.totalSources} changed`);

// Generate change report
const report = await detector.generateChangeReport(summary);
console.log(report);
```

### Change Report Example

```
Filter List Change Report
==================================================
Total Sources: 5
Changed: 2
Unchanged: 3
New: 0

Changes Detected:

  https://easylist.to/easylist/easylist.txt
    Rules: +127 (2.3%)

  https://easylist.to/easylist/easyprivacy.txt
    Rules: -43 (-1.5%)
```

## Complete Integration Example

Here's how to integrate all features into your compilation workflow:

```typescript
import {
    NoSqlStorage,
    CachingDownloader,
    SourceHealthMonitor,
    ChangeDetector,
} from './storage/index.ts';
import { FilterDownloader } from './downloader/FilterDownloader.ts';
import { FilterCompiler } from './compiler/FilterCompiler.ts';
import { logger } from './utils/logger.ts';

async function compileWithIntelligentStorage(config: IConfiguration) {
    // 1. Initialize storage
    const storage = new NoSqlStorage(logger);
    await storage.open();

    try {
        // 2. Create intelligent downloader
        const baseDownloader = new FilterDownloader();
        const cachingDownloader = new CachingDownloader(
            baseDownloader,
            storage,
            logger,
            {
                enabled: true,
                ttl: 3600000, // 1 hour
                detectChanges: true,
                monitorHealth: true,
            }
        );

        // 3. Check for unhealthy sources before starting
        const unhealthy = await cachingDownloader.getUnhealthySources();
        if (unhealthy.length > 0) {
            logger.warn(`Warning: ${unhealthy.length} unhealthy sources detected`);
            // Optionally skip unhealthy sources or alert user
        }

        // 4. Compile using the intelligent downloader
        const compiler = new FilterCompiler(
            config,
            cachingDownloader, // Use caching downloader
            logger
        );

        const startTime = Date.now();
        const result = await compiler.compile();
        const duration = Date.now() - startTime;

        // 5. Store compilation metadata
        await storage.storeCompilationMetadata({
            configName: config.name,
            timestamp: startTime,
            sourceCount: config.sources.length,
            ruleCount: result.length,
            duration,
            outputPath: './output/compiled.txt',
        });

        // 6. Generate reports
        const healthReport = await cachingDownloader.generateHealthReport();
        logger.info(`\n${healthReport}`);

        const cacheStats = await cachingDownloader.getCacheStats();
        logger.info(
            `Cache: ${cacheStats.totalCached} sources, ${(cacheStats.totalSize / 1024 / 1024).toFixed(2)} MB`
        );

        // 7. Clean up
        await storage.clearExpired();

        return result;
    } finally {
        await storage.close();
    }
}
```

## Best Practices

### Cache TTL Selection

- **Short-lived lists** (updated hourly): 30-60 minutes
- **Daily updated lists**: 6-12 hours
- **Stable lists**: 24 hours
- **Development**: 5-15 minutes

```typescript
const ttl = config.environment === 'development' 
    ? 300000   // 5 minutes
    : 3600000; // 1 hour
```

### Health Monitoring

1. **Check health before compilation**
   ```typescript
   const unhealthy = await cachingDownloader.getUnhealthySources();
   if (unhealthy.length > 0) {
       // Alert, skip, or use cached versions
   }
   ```

2. **Generate periodic reports**
   ```typescript
   // Daily health check
   setInterval(async () => {
       const report = await cachingDownloader.generateHealthReport();
       await sendNotification(report);
   }, 86400000); // 24 hours
   ```

3. **Clear unhealthy source data**
   ```typescript
   const healthMonitor = new SourceHealthMonitor(storage, logger);
   await healthMonitor.clearSourceHealth(deadSource);
   ```

### Change Detection

1. **Archive significant changes**
   ```typescript
   if (result.hasChanged && Math.abs(result.ruleCountDelta) > 100) {
       await changeDetector.archiveSnapshot(result.current);
   }
   ```

2. **Alert on large changes**
   ```typescript
   if (result.ruleCountChangePercent > 10) {
       logger.warn(`Large change detected: ${result.ruleCountChangePercent}%`);
       // Send notification
   }
   ```

3. **Track trends**
   ```typescript
   const history = await changeDetector.getSnapshotHistory(source, 30);
   const growth = history[0].ruleCount - history[history.length - 1].ruleCount;
   console.log(`30-day growth: ${growth} rules`);
   ```

### Storage Maintenance

1. **Regular cleanup**
   ```typescript
   // Clean expired entries daily
   setInterval(async () => {
       const cleared = await storage.clearExpired();
       logger.info(`Cleared ${cleared} expired entries`);
   }, 86400000);
   ```

2. **Monitor storage size**
   ```typescript
   const stats = await storage.getStats();
   if (stats.sizeEstimate > 100 * 1024 * 1024) { // 100MB
       logger.warn('Storage size exceeding 100MB');
       await storage.clearCache(); // Clear old cache
   }
   ```

3. **Backup important data**
   ```typescript
   // Export compilation history
   const history = await storage.getCompilationHistory(config.name, 100);
   await Deno.writeTextFile('history.json', JSON.stringify(history, null, 2));
   ```

### Performance Optimization

1. **Pre-warm cache for scheduled tasks**
   ```typescript
   // Before scheduled compilation
   await cachingDownloader.prewarmCache(config.sources.map(s => s.source));
   ```

2. **Use appropriate TTLs**
   - Balance between freshness and performance
   - Shorter TTL for frequently changing sources
   - Longer TTL for stable sources

3. **Batch operations**
   ```typescript
   // Download all sources in parallel when pre-warming
   await cachingDownloader.prewarmCache(sources);
   // Rather than sequential individual downloads
   ```

## Troubleshooting

### Cache Not Working

Check if storage is opened:
```typescript
await storage.open(); // Must call before using
```

Check cache options:
```typescript
const downloader = new CachingDownloader(base, storage, logger, {
    enabled: true, // Must be true
    forceRefresh: false, // Must be false to use cache
});
```

### High Storage Usage

Clear old cache entries:
```typescript
await storage.clearCache();
await storage.clearExpired();
```

Reduce cache TTL:
```typescript
const downloader = new CachingDownloader(base, storage, logger, {
    ttl: 1800000, // 30 minutes instead of 1 hour
});
```

### Unhealthy Sources

Check recent errors:
```typescript
const health = await healthMonitor.getHealthMetrics(source);
for (const attempt of health.recentAttempts.filter(a => !a.success)) {
    console.log(`Error: ${attempt.error}`);
}
```

Reset health data:
```typescript
await healthMonitor.clearSourceHealth(source);
```

## Running the Example

```bash
# Run the comprehensive example
deno run --allow-read --allow-write --allow-net --allow-env --unstable-kv src/storage/example.ts
```

This will demonstrate all features in action with real filter list sources.
