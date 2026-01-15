/**
 * Analytics Service for Cloudflare Analytics Engine integration.
 *
 * Provides a type-safe interface for tracking compilation metrics,
 * request analytics, and workflow events using Cloudflare Analytics Engine.
 *
 * @see https://developers.cloudflare.com/analytics/analytics-engine/
 *
 * ## Analytics Engine Data Model
 *
 * Analytics Engine supports up to:
 * - 1 index (blob1) - Used for grouping/filtering (e.g., event type)
 * - 20 doubles - Numeric values for aggregation
 * - 20 blobs - String values for categorization
 *
 * ## Event Types
 *
 * - `compilation_request` - A compilation was requested
 * - `compilation_success` - A compilation completed successfully
 * - `compilation_error` - A compilation failed
 * - `cache_hit` - A cached result was returned
 * - `cache_miss` - Cache miss, new compilation needed
 * - `rate_limit_exceeded` - Rate limit was exceeded
 * - `source_fetch` - A source URL was fetched
 * - `workflow_started` - A workflow was started
 * - `workflow_completed` - A workflow completed
 * - `workflow_failed` - A workflow failed
 */

/**
 * Interface for Analytics Engine dataset binding.
 * Matches the Cloudflare Workers Analytics Engine binding type.
 */
export interface AnalyticsEngineDataset {
    writeDataPoint(event?: AnalyticsEngineDataPoint): void;
}

/**
 * Data point structure for Analytics Engine.
 * @see https://developers.cloudflare.com/analytics/analytics-engine/get-started/
 */
export interface AnalyticsEngineDataPoint {
    /** Up to 1 index for grouping (max 32 bytes each) */
    indexes?: ((ArrayBuffer | string) | null)[];
    /** Up to 20 numeric values for aggregation */
    doubles?: number[];
    /** Up to 20 string/blob values for categorization (max 5120 bytes each) */
    blobs?: ((ArrayBuffer | string) | null)[];
}

/**
 * Event types tracked by the analytics service.
 */
export type AnalyticsEventType =
    | 'compilation_request'
    | 'compilation_success'
    | 'compilation_error'
    | 'cache_hit'
    | 'cache_miss'
    | 'rate_limit_exceeded'
    | 'source_fetch'
    | 'source_fetch_error'
    | 'workflow_started'
    | 'workflow_completed'
    | 'workflow_failed'
    | 'batch_compilation'
    | 'health_check'
    | 'api_request';

/**
 * Base event data common to all analytics events.
 */
interface BaseEventData {
    /** Request ID for correlation */
    requestId?: string;
    /** ISO timestamp when the event occurred */
    timestamp?: string;
}

/**
 * Event data for compilation-related events.
 */
export interface CompilationEventData extends BaseEventData {
    /** Name of the configuration being compiled */
    configName?: string;
    /** Number of sources in the configuration */
    sourceCount?: number;
    /** Number of rules in the output */
    ruleCount?: number;
    /** Total compilation duration in milliseconds */
    durationMs?: number;
    /** Size of the output in bytes */
    outputSizeBytes?: number;
    /** Whether the result was cached */
    cached?: boolean;
    /** Error message if compilation failed */
    error?: string;
    /** Cache key used */
    cacheKey?: string;
    /** Compression ratio if compressed */
    compressionRatio?: number;
}

/**
 * Event data for source fetch events.
 */
export interface SourceFetchEventData extends BaseEventData {
    /** URL of the source being fetched */
    sourceUrl?: string;
    /** Name of the source */
    sourceName?: string;
    /** HTTP status code */
    statusCode?: number;
    /** Fetch duration in milliseconds */
    durationMs?: number;
    /** Size of the fetched content in bytes */
    contentSizeBytes?: number;
    /** Whether the response was from cache */
    cached?: boolean;
    /** ETag of the response */
    etag?: string;
    /** Error message if fetch failed */
    error?: string;
}

/**
 * Event data for workflow events.
 */
export interface WorkflowEventData extends BaseEventData {
    /** Workflow instance ID */
    workflowId?: string;
    /** Type of workflow (compilation, batch, cache-warming, health) */
    workflowType?: string;
    /** Current step name */
    stepName?: string;
    /** Total duration in milliseconds */
    durationMs?: number;
    /** Number of items processed (for batch workflows) */
    itemCount?: number;
    /** Number of successful items */
    successCount?: number;
    /** Number of failed items */
    failedCount?: number;
    /** Error message if workflow failed */
    error?: string;
}

/**
 * Event data for API request events.
 */
export interface ApiRequestEventData extends BaseEventData {
    /** HTTP method */
    method?: string;
    /** Request path */
    path?: string;
    /** HTTP status code */
    statusCode?: number;
    /** Response time in milliseconds */
    responseTimeMs?: number;
    /** Client IP address (hashed for privacy) */
    clientIpHash?: string;
    /** User agent category */
    userAgentCategory?: string;
    /** Content type of the response */
    contentType?: string;
    /** Response size in bytes */
    responseSizeBytes?: number;
}

/**
 * Event data for rate limit events.
 */
export interface RateLimitEventData extends BaseEventData {
    /** Client IP address (hashed for privacy) */
    clientIpHash?: string;
    /** Current request count */
    requestCount?: number;
    /** Rate limit maximum */
    rateLimit?: number;
    /** Window size in seconds */
    windowSeconds?: number;
}

/**
 * Union type for all event data types.
 */
export type AnalyticsEventData =
    | CompilationEventData
    | SourceFetchEventData
    | WorkflowEventData
    | ApiRequestEventData
    | RateLimitEventData
    | BaseEventData;

/**
 * Analytics Service for tracking metrics via Cloudflare Analytics Engine.
 *
 * This service provides a high-level API for tracking various events
 * in the adblock-compiler system. It automatically handles:
 * - Timestamp generation
 * - Data point formatting
 * - Graceful degradation when Analytics Engine is not available
 *
 * @example
 * ```typescript
 * const analytics = new AnalyticsService(env.ANALYTICS_ENGINE);
 *
 * // Track a compilation request
 * analytics.trackCompilationRequest({
 *   requestId: 'abc123',
 *   configName: 'my-filter-list',
 *   sourceCount: 5
 * });
 *
 * // Track compilation success
 * analytics.trackCompilationSuccess({
 *   requestId: 'abc123',
 *   configName: 'my-filter-list',
 *   ruleCount: 50000,
 *   durationMs: 1234,
 *   outputSizeBytes: 512000
 * });
 * ```
 */
export class AnalyticsService {
    private readonly dataset: AnalyticsEngineDataset | undefined;
    private readonly enabled: boolean;

    /**
     * Creates a new AnalyticsService instance.
     *
     * @param dataset - The Analytics Engine dataset binding from the environment.
     *                  If undefined, the service will operate in no-op mode.
     */
    constructor(dataset?: AnalyticsEngineDataset) {
        this.dataset = dataset;
        this.enabled = dataset !== undefined;
    }

    /**
     * Checks if analytics tracking is enabled.
     */
    public isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Writes a raw data point to Analytics Engine.
     * This is a low-level method; prefer using the typed tracking methods.
     *
     * @param eventType - The type of event being tracked
     * @param data - The event data
     */
    public writeDataPoint(eventType: AnalyticsEventType, data: AnalyticsEventData): void {
        if (!this.enabled || !this.dataset) {
            return;
        }

        try {
            const dataPoint = this.formatDataPoint(eventType, data);
            this.dataset.writeDataPoint(dataPoint);
        } catch (error) {
            // Silently ignore errors to prevent analytics from affecting main flow
            // In production, you might want to log this to a separate error tracking system
            console.warn('[AnalyticsService] Failed to write data point:', error);
        }
    }

    /**
     * Formats event data into an Analytics Engine data point.
     *
     * Data point structure:
     * - indexes[0]: Event type (for filtering/grouping)
     * - doubles[0]: Duration in ms
     * - doubles[1]: Size in bytes
     * - doubles[2]: Count (rule count, item count, etc.)
     * - doubles[3]: Status code
     * - doubles[4]: Success indicator (1 = success, 0 = failure)
     * - blobs[0]: Request ID
     * - blobs[1]: Config/Source name
     * - blobs[2]: Error message (if any)
     * - blobs[3]: Additional context (path, workflow type, etc.)
     * - blobs[4]: Cache key or ETag
     */
    private formatDataPoint(eventType: AnalyticsEventType, data: AnalyticsEventData): AnalyticsEngineDataPoint {
        const doubles: number[] = [];
        const blobs: (string | null)[] = [];

        // Extract common numeric values
        const durationMs = 'durationMs' in data ? data.durationMs ?? 0 : 0;
        const responseTimeMs = 'responseTimeMs' in data ? data.responseTimeMs ?? 0 : 0;
        doubles.push(durationMs || responseTimeMs); // doubles[0]: Duration

        const sizeBytes = 'outputSizeBytes' in data
            ? data.outputSizeBytes ?? 0
            : 'contentSizeBytes' in data
            ? data.contentSizeBytes ?? 0
            : 'responseSizeBytes' in data
            ? data.responseSizeBytes ?? 0
            : 0;
        doubles.push(sizeBytes); // doubles[1]: Size

        const count = 'ruleCount' in data
            ? data.ruleCount ?? 0
            : 'itemCount' in data
            ? data.itemCount ?? 0
            : 'sourceCount' in data
            ? data.sourceCount ?? 0
            : 'requestCount' in data
            ? data.requestCount ?? 0
            : 0;
        doubles.push(count); // doubles[2]: Count

        const statusCode = 'statusCode' in data ? data.statusCode ?? 0 : 0;
        doubles.push(statusCode); // doubles[3]: Status code

        // Success indicator based on event type
        const isSuccessEvent = eventType.includes('success') || eventType.includes('hit') ||
            eventType.includes('completed');
        const isErrorEvent = eventType.includes('error') || eventType.includes('failed') ||
            eventType.includes('exceeded');
        doubles.push(isSuccessEvent ? 1 : isErrorEvent ? 0 : 0.5); // doubles[4]: Success indicator

        // Additional numeric fields
        if ('successCount' in data) doubles.push(data.successCount ?? 0);
        if ('failedCount' in data) doubles.push(data.failedCount ?? 0);
        if ('compressionRatio' in data) doubles.push(data.compressionRatio ?? 0);
        if ('rateLimit' in data) doubles.push(data.rateLimit ?? 0);
        if ('windowSeconds' in data) doubles.push(data.windowSeconds ?? 0);

        // Extract string values
        blobs.push(data.requestId ?? null); // blobs[0]: Request ID

        const name = 'configName' in data
            ? data.configName ?? null
            : 'sourceName' in data
            ? data.sourceName ?? null
            : 'workflowType' in data
            ? data.workflowType ?? null
            : null;
        blobs.push(name); // blobs[1]: Name

        const error = 'error' in data ? data.error ?? null : null;
        blobs.push(error); // blobs[2]: Error

        const context = 'path' in data
            ? data.path ?? null
            : 'sourceUrl' in data
            ? data.sourceUrl ?? null
            : 'stepName' in data
            ? data.stepName ?? null
            : 'workflowId' in data
            ? data.workflowId ?? null
            : null;
        blobs.push(context); // blobs[3]: Context

        const cacheInfo = 'cacheKey' in data
            ? data.cacheKey ?? null
            : 'etag' in data
            ? data.etag ?? null
            : null;
        blobs.push(cacheInfo); // blobs[4]: Cache info

        // Additional blob fields
        if ('method' in data) blobs.push(data.method ?? null);
        if ('clientIpHash' in data) blobs.push(data.clientIpHash ?? null);
        if ('userAgentCategory' in data) blobs.push(data.userAgentCategory ?? null);
        if ('contentType' in data) blobs.push(data.contentType ?? null);

        // Add timestamp as blob
        blobs.push(data.timestamp ?? new Date().toISOString());

        return {
            indexes: [eventType],
            doubles,
            blobs,
        };
    }

    // =========================================================================
    // High-level tracking methods
    // =========================================================================

    /**
     * Tracks a compilation request event.
     */
    public trackCompilationRequest(data: CompilationEventData): void {
        this.writeDataPoint('compilation_request', {
            ...data,
            timestamp: data.timestamp ?? new Date().toISOString(),
        });
    }

    /**
     * Tracks a successful compilation event.
     */
    public trackCompilationSuccess(data: CompilationEventData): void {
        this.writeDataPoint('compilation_success', {
            ...data,
            timestamp: data.timestamp ?? new Date().toISOString(),
        });
    }

    /**
     * Tracks a compilation error event.
     */
    public trackCompilationError(data: CompilationEventData): void {
        this.writeDataPoint('compilation_error', {
            ...data,
            timestamp: data.timestamp ?? new Date().toISOString(),
        });
    }

    /**
     * Tracks a cache hit event.
     */
    public trackCacheHit(data: CompilationEventData): void {
        this.writeDataPoint('cache_hit', {
            ...data,
            cached: true,
            timestamp: data.timestamp ?? new Date().toISOString(),
        });
    }

    /**
     * Tracks a cache miss event.
     */
    public trackCacheMiss(data: CompilationEventData): void {
        this.writeDataPoint('cache_miss', {
            ...data,
            cached: false,
            timestamp: data.timestamp ?? new Date().toISOString(),
        });
    }

    /**
     * Tracks a rate limit exceeded event.
     */
    public trackRateLimitExceeded(data: RateLimitEventData): void {
        this.writeDataPoint('rate_limit_exceeded', {
            ...data,
            timestamp: data.timestamp ?? new Date().toISOString(),
        });
    }

    /**
     * Tracks a source fetch event.
     */
    public trackSourceFetch(data: SourceFetchEventData): void {
        this.writeDataPoint('source_fetch', {
            ...data,
            timestamp: data.timestamp ?? new Date().toISOString(),
        });
    }

    /**
     * Tracks a source fetch error event.
     */
    public trackSourceFetchError(data: SourceFetchEventData): void {
        this.writeDataPoint('source_fetch_error', {
            ...data,
            timestamp: data.timestamp ?? new Date().toISOString(),
        });
    }

    /**
     * Tracks a workflow started event.
     */
    public trackWorkflowStarted(data: WorkflowEventData): void {
        this.writeDataPoint('workflow_started', {
            ...data,
            timestamp: data.timestamp ?? new Date().toISOString(),
        });
    }

    /**
     * Tracks a workflow completed event.
     */
    public trackWorkflowCompleted(data: WorkflowEventData): void {
        this.writeDataPoint('workflow_completed', {
            ...data,
            timestamp: data.timestamp ?? new Date().toISOString(),
        });
    }

    /**
     * Tracks a workflow failed event.
     */
    public trackWorkflowFailed(data: WorkflowEventData): void {
        this.writeDataPoint('workflow_failed', {
            ...data,
            timestamp: data.timestamp ?? new Date().toISOString(),
        });
    }

    /**
     * Tracks a batch compilation event.
     */
    public trackBatchCompilation(data: WorkflowEventData): void {
        this.writeDataPoint('batch_compilation', {
            ...data,
            timestamp: data.timestamp ?? new Date().toISOString(),
        });
    }

    /**
     * Tracks a health check event.
     */
    public trackHealthCheck(data: WorkflowEventData): void {
        this.writeDataPoint('health_check', {
            ...data,
            timestamp: data.timestamp ?? new Date().toISOString(),
        });
    }

    /**
     * Tracks an API request event.
     */
    public trackApiRequest(data: ApiRequestEventData): void {
        this.writeDataPoint('api_request', {
            ...data,
            timestamp: data.timestamp ?? new Date().toISOString(),
        });
    }

    // =========================================================================
    // Utility methods
    // =========================================================================

    /**
     * Hashes an IP address for privacy-preserving analytics.
     * Uses a simple hash that cannot be reversed to the original IP.
     *
     * @param ip - The IP address to hash
     * @returns A hashed representation of the IP
     */
    public static hashIp(ip: string): string {
        // Simple hash function for IP anonymization
        let hash = 0;
        for (let i = 0; i < ip.length; i++) {
            const char = ip.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return `ip_${Math.abs(hash).toString(16)}`;
    }

    /**
     * Categorizes a user agent string into broad categories.
     *
     * @param userAgent - The User-Agent header value
     * @returns A category string
     */
    public static categorizeUserAgent(userAgent: string | null): string {
        if (!userAgent) return 'unknown';

        const ua = userAgent.toLowerCase();

        if (ua.includes('curl') || ua.includes('wget') || ua.includes('httpie')) {
            return 'cli_tool';
        }
        if (ua.includes('python') || ua.includes('node') || ua.includes('deno') || ua.includes('go-http')) {
            return 'programming_language';
        }
        if (ua.includes('postman') || ua.includes('insomnia')) {
            return 'api_client';
        }
        if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
            return 'bot';
        }
        if (ua.includes('chrome') || ua.includes('firefox') || ua.includes('safari') || ua.includes('edge')) {
            return 'browser';
        }

        return 'other';
    }
}
