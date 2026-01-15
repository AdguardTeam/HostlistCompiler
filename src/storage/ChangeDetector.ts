import type { IDetailedLogger } from '../types/index.ts';
import type { IStorageAdapter } from './IStorageAdapter.ts';

/**
 * Snapshot of a source's content
 */
export interface SourceSnapshot {
    /** Source URL or path */
    source: string;
    /** Timestamp of snapshot */
    timestamp: number;
    /** Content hash */
    hash: string;
    /** Number of rules */
    ruleCount: number;
    /** Sample of first 10 rules */
    ruleSample: string[];
    /** ETag if available */
    etag?: string;
}

/**
 * Change detection result
 */
export interface ChangeDetectionResult {
    /** Whether the source has changed */
    hasChanged: boolean;
    /** Previous snapshot if exists */
    previous?: SourceSnapshot;
    /** Current snapshot */
    current: SourceSnapshot;
    /** Difference in rule count */
    ruleCountDelta: number;
    /** Percentage change in rule count */
    ruleCountChangePercent: number;
    /** Time since last snapshot */
    timeSinceLastSnapshot?: number;
}

/**
 * Change summary for reporting
 */
export interface ChangeSummary {
    /** Total sources checked */
    totalSources: number;
    /** Sources that changed */
    changedSources: number;
    /** Sources that didn't change */
    unchangedSources: number;
    /** New sources */
    newSources: number;
    /** Details of changed sources */
    changes: Array<{
        source: string;
        ruleCountDelta: number;
        changePercent: number;
    }>;
}

/**
 * Detects changes in filter list sources
 */
export class ChangeDetector {
    private readonly storage: IStorageAdapter;
    private readonly logger: IDetailedLogger;

    constructor(storage: IStorageAdapter, logger: IDetailedLogger) {
        this.storage = storage;
        this.logger = logger;
    }

    /**
     * Creates a snapshot of a source's current state
     */
    createSnapshot(
        source: string,
        content: string[],
        hash: string,
        etag?: string,
    ): SourceSnapshot {
        return {
            source,
            timestamp: Date.now(),
            hash,
            ruleCount: content.length,
            ruleSample: content.slice(0, 10),
            etag,
        };
    }

    /**
     * Stores a snapshot for future comparison
     */
    async storeSnapshot(snapshot: SourceSnapshot): Promise<void> {
        await this.storage.set(
            ['snapshots', 'sources', snapshot.source],
            snapshot,
        );
        this.logger.debug(`Stored snapshot for ${snapshot.source}`);
    }

    /**
     * Gets the last snapshot for a source
     */
    async getLastSnapshot(source: string): Promise<SourceSnapshot | null> {
        const entry = await this.storage.get<SourceSnapshot>([
            'snapshots',
            'sources',
            source,
        ]);
        return entry?.data || null;
    }

    /**
     * Detects changes by comparing current content with last snapshot
     */
    async detectChanges(
        source: string,
        content: string[],
        hash: string,
        etag?: string,
    ): Promise<ChangeDetectionResult> {
        const current = this.createSnapshot(source, content, hash, etag);
        const previous = await this.getLastSnapshot(source);

        if (!previous) {
            // New source - no previous snapshot
            return {
                hasChanged: true,
                current,
                ruleCountDelta: current.ruleCount,
                ruleCountChangePercent: 100,
            };
        }

        // Compare hashes
        const hasChanged = previous.hash !== current.hash;
        const ruleCountDelta = current.ruleCount - previous.ruleCount;
        const ruleCountChangePercent = previous.ruleCount > 0 ? (ruleCountDelta / previous.ruleCount) * 100 : 0;
        const timeSinceLastSnapshot = current.timestamp - previous.timestamp;

        if (hasChanged) {
            this.logger.info(
                `Source ${source} changed: ${ruleCountDelta > 0 ? '+' : ''}${ruleCountDelta} rules (${ruleCountChangePercent.toFixed(1)}%)`,
            );
        }

        return {
            hasChanged,
            previous,
            current,
            ruleCountDelta,
            ruleCountChangePercent,
            timeSinceLastSnapshot,
        };
    }

    /**
     * Detects changes and stores new snapshot if changed
     */
    async detectAndStore(
        source: string,
        content: string[],
        hash: string,
        etag?: string,
    ): Promise<ChangeDetectionResult> {
        const result = await this.detectChanges(source, content, hash, etag);

        // Always store the new snapshot
        await this.storeSnapshot(result.current);

        return result;
    }

    /**
     * Gets all source snapshots
     */
    async getAllSnapshots(): Promise<SourceSnapshot[]> {
        const entries = await this.storage.list<SourceSnapshot>({
            prefix: ['snapshots', 'sources'],
        });
        return entries.map((e) => e.value.data);
    }

    /**
     * Gets snapshot history for a specific source
     */
    async getSnapshotHistory(
        source: string,
        limit: number = 10,
    ): Promise<SourceSnapshot[]> {
        const entries = await this.storage.list<SourceSnapshot>({
            prefix: ['snapshots', 'history', source],
            limit,
            reverse: true,
        });
        return entries.map((e) => e.value.data);
    }

    /**
     * Stores snapshot in history (for tracking changes over time)
     */
    async archiveSnapshot(snapshot: SourceSnapshot): Promise<void> {
        const key = [
            'snapshots',
            'history',
            snapshot.source,
            snapshot.timestamp.toString(),
        ];
        await this.storage.set(key, snapshot);
    }

    /**
     * Generates a change summary for multiple sources
     */
    async generateChangeSummary(
        results: ChangeDetectionResult[],
    ): Promise<ChangeSummary> {
        const totalSources = results.length;
        const changedSources = results.filter((r) => r.hasChanged && r.previous).length;
        const unchangedSources = results.filter((r) => !r.hasChanged).length;
        const newSources = results.filter((r) => r.hasChanged && !r.previous).length;

        const changes = results
            .filter((r) => r.hasChanged)
            .map((r) => ({
                source: r.current.source,
                ruleCountDelta: r.ruleCountDelta,
                changePercent: r.ruleCountChangePercent,
            }));

        return {
            totalSources,
            changedSources,
            unchangedSources,
            newSources,
            changes,
        };
    }

    /**
     * Generates a detailed change report
     */
    async generateChangeReport(summary: ChangeSummary): Promise<string> {
        let report = 'Filter List Change Report\n';
        report += `${'='.repeat(50)}\n\n`;
        report += `Total Sources: ${summary.totalSources}\n`;
        report += `Changed: ${summary.changedSources}\n`;
        report += `Unchanged: ${summary.unchangedSources}\n`;
        report += `New: ${summary.newSources}\n\n`;

        if (summary.changes.length > 0) {
            report += 'Changes Detected:\n';
            for (const change of summary.changes) {
                const deltaSign = change.ruleCountDelta >= 0 ? '+' : '';
                report += `\n  ${change.source}\n`;
                report += `    Rules: ${deltaSign}${change.ruleCountDelta} (${change.changePercent.toFixed(1)}%)\n`;
            }
        }

        return report;
    }

    /**
     * Compares two snapshots to detect specific changes
     */
    async compareSnapshots(
        oldSnapshot: SourceSnapshot,
        newSnapshot: SourceSnapshot,
    ): Promise<{
        addedRules: number;
        removedRules: number;
        modified: boolean;
    }> {
        const ruleCountDiff = newSnapshot.ruleCount - oldSnapshot.ruleCount;

        return {
            addedRules: ruleCountDiff > 0 ? ruleCountDiff : 0,
            removedRules: ruleCountDiff < 0 ? Math.abs(ruleCountDiff) : 0,
            modified: oldSnapshot.hash !== newSnapshot.hash,
        };
    }

    /**
     * Clears all snapshots
     */
    async clearAllSnapshots(): Promise<number> {
        const entries = await this.storage.list({
            prefix: ['snapshots'],
        });
        let count = 0;

        for (const entry of entries) {
            if (await this.storage.delete(entry.key)) {
                count++;
            }
        }

        this.logger.info(`Cleared ${count} snapshots`);
        return count;
    }

    /**
     * Clears snapshots for a specific source
     */
    async clearSourceSnapshots(source: string): Promise<void> {
        await this.storage.delete(['snapshots', 'sources', source]);

        // Also clear history
        const historyEntries = await this.storage.list({
            prefix: ['snapshots', 'history', source],
        });

        for (const entry of historyEntries) {
            await this.storage.delete(entry.key);
        }

        this.logger.info(`Cleared snapshots for ${source}`);
    }
}
