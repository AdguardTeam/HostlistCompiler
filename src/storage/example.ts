/**
 * Example usage of the intelligent storage system
 *
 * This demonstrates:
 * - Caching with TTL
 * - Health monitoring
 * - Change detection
 * - Pre-warming cache
 * - Generating reports
 *
 * Run with:
 *   deno run --allow-all src/storage/example.ts
 */

import { PrismaStorageAdapter, CachingDownloader } from './index.ts';
import { FilterDownloader } from '../downloader/FilterDownloader.ts';
import { logger } from '../utils/logger.ts';

async function main() {
    // Initialize storage with Prisma (SQLite by default)
    const storage = new PrismaStorageAdapter(logger, {
        type: 'prisma',
        // Uses DATABASE_URL env var or defaults to file:./dev.db
    });
    await storage.open();

    try {
        // Create base downloader
        const baseDownloader = new FilterDownloader();

        // Wrap with intelligent caching
        const cachingDownloader = new CachingDownloader(
            baseDownloader,
            storage,
            logger,
            {
                enabled: true,
                ttl: 3600000, // 1 hour
                detectChanges: true,
                monitorHealth: true,
                forceRefresh: false,
            },
        );

        // Example filter sources
        const sources = [
            'https://easylist.to/easylist/easylist.txt',
            'https://easylist.to/easylist/easyprivacy.txt',
            'https://adguardteam.github.io/HostlistsRegistry/assets/filter_1.txt',
        ];

        console.log('='.repeat(60));
        console.log('Intelligent Filter List Compiler - Storage Demo');
        console.log('='.repeat(60));
        console.log();

        // 1. Pre-warm the cache
        console.log('Step 1: Pre-warming cache...');
        const prewarmResult = await cachingDownloader.prewarmCache(sources);
        console.log(
            `✓ Pre-warming complete: ${prewarmResult.successful}/${sources.length} successful`,
        );
        if (prewarmResult.errors.length > 0) {
            console.log('  Errors:');
            for (const error of prewarmResult.errors) {
                console.log(`    - ${error.source}: ${error.error}`);
            }
        }
        console.log();

        // 2. Download with caching (will use cache)
        console.log('Step 2: Downloading with cache...');
        for (const source of sources) {
            const result = await cachingDownloader.downloadWithMetadata(source);
            console.log(`  ${source}`);
            console.log(`    From cache: ${result.fromCache}`);
            console.log(`    Rules: ${result.content.length}`);
            console.log(`    Duration: ${result.duration}ms`);
            if (result.hasChanged !== undefined) {
                console.log(`    Changed: ${result.hasChanged}`);
                if (result.hasChanged && result.ruleCountDelta) {
                    console.log(
                        `    Delta: ${result.ruleCountDelta > 0 ? '+' : ''}${result.ruleCountDelta} rules`,
                    );
                }
            }
        }
        console.log();

        // 3. Check cache statistics
        console.log('Step 3: Cache statistics...');
        const cacheStats = await cachingDownloader.getCacheStats();
        console.log(`  Cached sources: ${cacheStats.totalCached}`);
        console.log(`  Total size: ${(cacheStats.totalSize / 1024 / 1024).toFixed(2)} MB`);
        if (cacheStats.oldestCache) {
            const age = Date.now() - cacheStats.oldestCache;
            console.log(`  Oldest cache: ${Math.round(age / 60000)} minutes ago`);
        }
        console.log();

        // 4. Generate health report
        console.log('Step 4: Source health report...');
        const healthReport = await cachingDownloader.generateHealthReport();
        console.log(healthReport);

        // 5. Check for unhealthy sources
        const unhealthySources = await cachingDownloader.getUnhealthySources();
        if (unhealthySources.length > 0) {
            console.log('⚠️  Warning: Unhealthy sources detected!');
            for (const source of unhealthySources) {
                console.log(`  - ${source.source} (${source.status})`);
                console.log(`    Success rate: ${(source.successRate * 100).toFixed(1)}%`);
                console.log(`    Consecutive failures: ${source.consecutiveFailures}`);
            }
            console.log();
        }

        // 6. View change history for a source
        if (sources.length > 0) {
            console.log(`Step 5: Change history for first source...`);
            const history = await cachingDownloader.getChangeHistory(sources[0], 5);
            if (history.length > 0) {
                console.log(`  Found ${history.length} snapshots:`);
                for (const snapshot of history) {
                    const date = new Date(snapshot.timestamp);
                    console.log(`    - ${date.toISOString()}: ${snapshot.ruleCount} rules`);
                }
            } else {
                console.log('  No change history yet');
            }
            console.log();
        }

        // 7. Storage statistics
        console.log('Step 6: Overall storage statistics...');
        const storageStats = await storage.getStats();
        console.log(`  Total entries: ${storageStats.entryCount}`);
        console.log(`  Expired entries: ${storageStats.expiredCount}`);
        console.log(`  Storage size: ${(storageStats.sizeEstimate / 1024 / 1024).toFixed(2)} MB`);
        console.log();

        // 8. Get compilation history
        console.log('Step 7: Compilation history...');
        const compilations = await storage.getCompilationHistory('example-config', 5);
        if (compilations.length > 0) {
            console.log(`  Found ${compilations.length} recent compilations:`);
            for (const comp of compilations) {
                const date = new Date(comp.timestamp);
                console.log(
                    `    - ${date.toISOString()}: ${comp.ruleCount} rules in ${comp.duration}ms`,
                );
            }
        } else {
            console.log('  No compilation history yet');
        }
        console.log();

        // 9. Demonstrate forced refresh
        console.log('Step 8: Testing forced refresh...');
        const forcedDownloader = new CachingDownloader(
            baseDownloader,
            storage,
            logger,
            {
                enabled: true,
                forceRefresh: true, // Force fresh download
                detectChanges: true,
                monitorHealth: true,
            },
        );

        if (sources.length > 0) {
            const result = await forcedDownloader.downloadWithMetadata(sources[0]);
            console.log(`  Downloaded ${sources[0]}`);
            console.log(`  From cache: ${result.fromCache} (should be false)`);
            console.log(`  Rules: ${result.content.length}`);
        }
        console.log();

        // 10. Cleanup expired entries
        console.log('Step 9: Cleaning up...');
        const expired = await storage.clearExpired();
        console.log(`  Cleared ${expired} expired entries`);

        console.log();
        console.log('='.repeat(60));
        console.log('Demo complete!');
        console.log('='.repeat(60));
    } finally {
        await storage.close();
    }
}

// Run the example
if (import.meta.main) {
    main().catch((error) => {
        console.error('Example failed:', error);
        Deno.exit(1);
    });
}
