import type { IDetailedLogger } from '../types/index.ts';
import type { IStorageAdapter } from './IStorageAdapter.ts';

/**
 * Health status for a source
 */
export enum HealthStatus {
    Healthy = 'healthy',
    Degraded = 'degraded',
    Unhealthy = 'unhealthy',
    Unknown = 'unknown',
}

/**
 * Record of a source fetch attempt
 */
export interface SourceAttempt {
    /** Timestamp of the attempt */
    timestamp: number;
    /** Whether the attempt succeeded */
    success: boolean;
    /** Duration in milliseconds */
    duration: number;
    /** Error message if failed */
    error?: string;
    /** Number of rules fetched (if successful) */
    ruleCount?: number;
    /** ETag or version identifier */
    etag?: string;
}

/**
 * Health metrics for a source
 */
export interface SourceHealthMetrics {
    /** Source URL or path */
    source: string;
    /** Overall health status */
    status: HealthStatus;
    /** Total number of attempts */
    totalAttempts: number;
    /** Number of successful attempts */
    successfulAttempts: number;
    /** Number of failed attempts */
    failedAttempts: number;
    /** Success rate (0-1) */
    successRate: number;
    /** Average duration in milliseconds */
    averageDuration: number;
    /** Last attempt timestamp */
    lastAttempt?: number;
    /** Last successful attempt timestamp */
    lastSuccess?: number;
    /** Last failure timestamp */
    lastFailure?: number;
    /** Recent attempts (up to 10) */
    recentAttempts: SourceAttempt[];
    /** Average rule count */
    averageRuleCount?: number;
    /** Is currently failing? */
    isCurrentlyFailing: boolean;
    /** Consecutive failures */
    consecutiveFailures: number;
}

/**
 * Monitors source health and tracks fetch attempts
 */
export class SourceHealthMonitor {
    private readonly storage: IStorageAdapter;
    private readonly logger: IDetailedLogger;
    private readonly maxRecentAttempts: number;

    constructor(
        storage: IStorageAdapter,
        logger: IDetailedLogger,
        maxRecentAttempts: number = 10,
    ) {
        this.storage = storage;
        this.logger = logger;
        this.maxRecentAttempts = maxRecentAttempts;
    }

    /**
     * Records a fetch attempt for a source
     */
    async recordAttempt(
        source: string,
        success: boolean,
        duration: number,
        options?: {
            error?: string;
            ruleCount?: number;
            etag?: string;
        },
    ): Promise<void> {
        const attempt: SourceAttempt = {
            timestamp: Date.now(),
            success,
            duration,
            error: options?.error,
            ruleCount: options?.ruleCount,
            etag: options?.etag,
        };

        // Get existing metrics
        const metrics = await this.getHealthMetrics(source);

        // Update attempts list
        const recentAttempts = [attempt, ...metrics.recentAttempts].slice(
            0,
            this.maxRecentAttempts,
        );

        // Calculate new metrics
        const totalAttempts = metrics.totalAttempts + 1;
        const successfulAttempts = metrics.successfulAttempts + (success ? 1 : 0);
        const failedAttempts = metrics.failedAttempts + (success ? 0 : 1);
        const successRate = successfulAttempts / totalAttempts;

        // Calculate average duration
        const allDurations = recentAttempts.map((a) => a.duration);
        const averageDuration = allDurations.reduce((a, b) => a + b, 0) / allDurations.length;

        // Calculate average rule count
        const successfulWithRules = recentAttempts.filter((a) => a.success && a.ruleCount);
        const averageRuleCount = successfulWithRules.length > 0
            ? successfulWithRules.reduce((sum, a) => sum + (a.ruleCount || 0), 0) /
                successfulWithRules.length
            : undefined;

        // Calculate consecutive failures
        let consecutiveFailures = 0;
        for (const a of recentAttempts) {
            if (!a.success) {
                consecutiveFailures++;
            } else {
                break;
            }
        }

        // Determine health status
        const status = this.calculateHealthStatus(successRate, consecutiveFailures);

        const newMetrics: SourceHealthMetrics = {
            source,
            status,
            totalAttempts,
            successfulAttempts,
            failedAttempts,
            successRate,
            averageDuration,
            lastAttempt: attempt.timestamp,
            lastSuccess: success ? attempt.timestamp : metrics.lastSuccess,
            lastFailure: !success ? attempt.timestamp : metrics.lastFailure,
            recentAttempts,
            averageRuleCount,
            isCurrentlyFailing: !success,
            consecutiveFailures,
        };

        // Store updated metrics
        await this.storage.set(['health', 'sources', source], newMetrics);

        // Log significant events
        if (status === HealthStatus.Unhealthy) {
            this.logger.warn(
                `Source ${source} is unhealthy: ${consecutiveFailures} consecutive failures`,
            );
        } else if (status === HealthStatus.Degraded) {
            this.logger.warn(`Source ${source} is degraded: ${(successRate * 100).toFixed(1)}% success rate`);
        }
    }

    /**
     * Gets health metrics for a source
     */
    async getHealthMetrics(source: string): Promise<SourceHealthMetrics> {
        const entry = await this.storage.get<SourceHealthMetrics>(['health', 'sources', source]);

        if (entry?.data) {
            return entry.data;
        }

        // Return default metrics for new sources
        return {
            source,
            status: HealthStatus.Unknown,
            totalAttempts: 0,
            successfulAttempts: 0,
            failedAttempts: 0,
            successRate: 0,
            averageDuration: 0,
            recentAttempts: [],
            isCurrentlyFailing: false,
            consecutiveFailures: 0,
        };
    }

    /**
     * Gets all monitored sources
     */
    async getAllSources(): Promise<SourceHealthMetrics[]> {
        const entries = await this.storage.list<SourceHealthMetrics>({
            prefix: ['health', 'sources'],
        });

        return entries.map((e) => e.value.data);
    }

    /**
     * Gets unhealthy sources
     */
    async getUnhealthySources(): Promise<SourceHealthMetrics[]> {
        const allSources = await this.getAllSources();
        return allSources.filter(
            (s) => s.status === HealthStatus.Unhealthy || s.status === HealthStatus.Degraded,
        );
    }

    /**
     * Gets sources that are currently failing
     */
    async getFailingSources(): Promise<SourceHealthMetrics[]> {
        const allSources = await this.getAllSources();
        return allSources.filter((s) => s.isCurrentlyFailing);
    }

    /**
     * Calculates health status based on metrics
     */
    private calculateHealthStatus(successRate: number, consecutiveFailures: number): HealthStatus {
        // If 3+ consecutive failures, it's unhealthy
        if (consecutiveFailures >= 3) {
            return HealthStatus.Unhealthy;
        }

        // If 1-2 consecutive failures, it's degraded
        if (consecutiveFailures > 0) {
            return HealthStatus.Degraded;
        }

        // Check overall success rate
        if (successRate >= 0.95) {
            return HealthStatus.Healthy;
        } else if (successRate >= 0.80) {
            return HealthStatus.Degraded;
        } else {
            return HealthStatus.Unhealthy;
        }
    }

    /**
     * Generates a health report for all sources
     */
    async generateHealthReport(): Promise<string> {
        const allSources = await this.getAllSources();

        if (allSources.length === 0) {
            return 'No sources monitored yet.';
        }

        const healthy = allSources.filter((s) => s.status === HealthStatus.Healthy).length;
        const degraded = allSources.filter((s) => s.status === HealthStatus.Degraded).length;
        const unhealthy = allSources.filter((s) => s.status === HealthStatus.Unhealthy).length;

        let report = `Source Health Report\n`;
        report += `${'='.repeat(50)}\n\n`;
        report += `Total Sources: ${allSources.length}\n`;
        report += `Healthy: ${healthy}\n`;
        report += `Degraded: ${degraded}\n`;
        report += `Unhealthy: ${unhealthy}\n\n`;

        // List unhealthy sources
        if (unhealthy > 0) {
            report += `Unhealthy Sources:\n`;
            const unhealthySources = allSources.filter((s) => s.status === HealthStatus.Unhealthy);
            for (const source of unhealthySources) {
                report += `  - ${source.source}\n`;
                report += `    Success Rate: ${(source.successRate * 100).toFixed(1)}%\n`;
                report += `    Consecutive Failures: ${source.consecutiveFailures}\n`;
                if (source.lastFailure) {
                    const elapsed = Date.now() - source.lastFailure;
                    report += `    Last Failure: ${Math.round(elapsed / 60000)} minutes ago\n`;
                }
                report += `\n`;
            }
        }

        // List degraded sources
        if (degraded > 0) {
            report += `Degraded Sources:\n`;
            const degradedSources = allSources.filter((s) => s.status === HealthStatus.Degraded);
            for (const source of degradedSources) {
                report += `  - ${source.source}\n`;
                report += `    Success Rate: ${(source.successRate * 100).toFixed(1)}%\n`;
                report += `    Consecutive Failures: ${source.consecutiveFailures}\n`;
                report += `\n`;
            }
        }

        return report;
    }

    /**
     * Clears health data for a specific source
     */
    async clearSourceHealth(source: string): Promise<void> {
        await this.storage.delete(['health', 'sources', source]);
        this.logger.info(`Cleared health data for source: ${source}`);
    }

    /**
     * Clears all health data
     */
    async clearAllHealth(): Promise<number> {
        const entries = await this.storage.list({ prefix: ['health'] });
        let count = 0;

        for (const entry of entries) {
            if (await this.storage.delete(entry.key)) {
                count++;
            }
        }

        this.logger.info(`Cleared health data for ${count} sources`);
        return count;
    }
}
