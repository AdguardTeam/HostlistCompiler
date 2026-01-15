/**
 * Lightweight benchmarking utility for measuring compilation performance.
 * Provides timing information for various stages of the compilation process.
 */

/**
 * Result of a benchmark measurement for a single stage.
 */
export interface BenchmarkResult {
    /** Name of the benchmark stage */
    name: string;
    /** Duration of the stage in milliseconds */
    durationMs: number;
    /** Number of items processed in this stage */
    itemCount?: number;
    /** Throughput: items processed per second */
    itemsPerSecond?: number;
}

/**
 * Aggregated metrics for a compilation run.
 */
export interface CompilationMetrics {
    /** Total duration of the compilation in milliseconds */
    totalDurationMs: number;
    /** Individual stage benchmark results */
    stages: BenchmarkResult[];
    /** Number of sources processed */
    sourceCount: number;
    /** Total input rule count before transformations */
    ruleCount: number;
    /** Final output rule count after all transformations */
    outputRuleCount: number;
}

/**
 * Timer utility for measuring operation duration.
 */
export class Timer {
    private startTime: number = 0;
    private endTime: number = 0;

    /**
     * Starts the timer.
     */
    public start(): void {
        this.startTime = performance.now();
        this.endTime = 0;
    }

    /**
     * Stops the timer and returns the elapsed time in milliseconds.
     */
    public stop(): number {
        this.endTime = performance.now();
        return this.elapsed;
    }

    /**
     * Gets the elapsed time in milliseconds.
     */
    public get elapsed(): number {
        const end = this.endTime || performance.now();
        return end - this.startTime;
    }

    /**
     * Formats the elapsed time as a human-readable string.
     */
    public format(): string {
        return formatDuration(this.elapsed);
    }
}

/**
 * Benchmark collector for tracking multiple stages.
 */
export class BenchmarkCollector {
    private readonly stages: BenchmarkResult[] = [];
    private readonly totalTimer: Timer = new Timer();
    private sourceCount: number = 0;
    private ruleCount: number = 0;
    private outputRuleCount: number = 0;

    /**
     * Starts the overall benchmark timing.
     */
    public start(): void {
        this.totalTimer.start();
    }

    /**
     * Records a benchmark result for a stage.
     */
    public recordStage(name: string, durationMs: number, itemCount?: number): void {
        const result: BenchmarkResult = {
            name,
            durationMs,
            itemCount,
        };

        if (itemCount !== undefined && durationMs > 0) {
            result.itemsPerSecond = Math.round((itemCount / durationMs) * 1000);
        }

        this.stages.push(result);
    }

    /**
     * Times a synchronous operation and records it.
     */
    public timeSync<T>(name: string, operation: () => T, itemCount?: number): T {
        const timer = new Timer();
        timer.start();
        const result = operation();
        const duration = timer.stop();
        this.recordStage(name, duration, itemCount);
        return result;
    }

    /**
     * Times an asynchronous operation and records it.
     */
    public async timeAsync<T>(
        name: string,
        operation: () => Promise<T>,
        getItemCount?: (result: T) => number,
    ): Promise<T> {
        const timer = new Timer();
        timer.start();
        const result = await operation();
        const duration = timer.stop();
        const itemCount = getItemCount ? getItemCount(result) : undefined;
        this.recordStage(name, duration, itemCount);
        return result;
    }

    /**
     * Sets the source count metric.
     */
    public setSourceCount(count: number): void {
        this.sourceCount = count;
    }

    /**
     * Sets the rule count metric.
     */
    public setRuleCount(count: number): void {
        this.ruleCount = count;
    }

    /**
     * Sets the output rule count metric.
     */
    public setOutputRuleCount(count: number): void {
        this.outputRuleCount = count;
    }

    /**
     * Finalizes the benchmark and returns the metrics.
     */
    public finish(): CompilationMetrics {
        return {
            totalDurationMs: this.totalTimer.stop(),
            stages: [...this.stages],
            sourceCount: this.sourceCount,
            ruleCount: this.ruleCount,
            outputRuleCount: this.outputRuleCount,
        };
    }

    /**
     * Generates a formatted report of the benchmark results.
     */
    public generateReport(): string {
        const metrics = this.finish();
        const lines: string[] = [
            '',
            '┌─────────────────────────────────────────────────────────────┐',
            '│                   COMPILATION BENCHMARK                     │',
            '├─────────────────────────────────────────────────────────────┤',
        ];

        // Summary metrics
        lines.push(`│  Sources: ${metrics.sourceCount.toString().padStart(10)} │ Input rules: ${metrics.ruleCount.toString().padStart(10)} │`);
        lines.push(`│  Output:  ${metrics.outputRuleCount.toString().padStart(10)} │ Total time:  ${formatDuration(metrics.totalDurationMs).padStart(10)} │`);
        lines.push('├─────────────────────────────────────────────────────────────┤');
        lines.push('│  Stage                              Time        Items/sec  │');
        lines.push('├─────────────────────────────────────────────────────────────┤');

        // Stage details
        for (const stage of metrics.stages) {
            const name = stage.name.padEnd(30).substring(0, 30);
            const time = formatDuration(stage.durationMs).padStart(10);
            const throughput = stage.itemsPerSecond ? formatNumber(stage.itemsPerSecond).padStart(10) : '       N/A';
            lines.push(`│  ${name}  ${time}  ${throughput}  │`);
        }

        lines.push('└─────────────────────────────────────────────────────────────┘');
        lines.push('');

        return lines.join('\n');
    }
}

/**
 * Formats a duration in milliseconds to a human-readable string.
 */
export function formatDuration(ms: number): string {
    if (ms < 1) {
        return `${(ms * 1000).toFixed(0)}µs`;
    }
    if (ms < 1000) {
        return `${ms.toFixed(1)}ms`;
    }
    if (ms < 60000) {
        return `${(ms / 1000).toFixed(2)}s`;
    }
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
}

/**
 * Formats a number with thousands separators.
 */
export function formatNumber(num: number): string {
    return num.toLocaleString('en-US');
}
