/**
 * Tests for AnalyticsService
 */

import { assertEquals } from '@std/assert';
import {
    AnalyticsEngineDataPoint,
    AnalyticsEngineDataset,
    AnalyticsService,
    ApiRequestEventData,
    CompilationEventData,
    RateLimitEventData,
    SourceFetchEventData,
    WorkflowEventData,
} from './AnalyticsService.ts';

/**
 * Mock Analytics Engine Dataset for testing
 */
class MockAnalyticsDataset implements AnalyticsEngineDataset {
    public dataPoints: AnalyticsEngineDataPoint[] = [];

    writeDataPoint(event?: AnalyticsEngineDataPoint): void {
        if (event) {
            this.dataPoints.push(event);
        }
    }

    clear(): void {
        this.dataPoints = [];
    }
}

Deno.test('AnalyticsService - constructor', async (t) => {
    await t.step('should create instance without dataset (no-op mode)', () => {
        const service = new AnalyticsService();

        assertEquals(service.isEnabled(), false);
    });

    await t.step('should create instance with dataset', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        assertEquals(service.isEnabled(), true);
    });

    await t.step('should create instance with undefined dataset', () => {
        const service = new AnalyticsService(undefined);

        assertEquals(service.isEnabled(), false);
    });
});

Deno.test('AnalyticsService - isEnabled', async (t) => {
    await t.step('should return false when no dataset', () => {
        const service = new AnalyticsService();

        assertEquals(service.isEnabled(), false);
    });

    await t.step('should return true when dataset provided', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        assertEquals(service.isEnabled(), true);
    });
});

Deno.test('AnalyticsService - writeDataPoint', async (t) => {
    await t.step('should write data point when enabled', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        const data: CompilationEventData = {
            requestId: 'test-123',
            configName: 'My Filter',
        };

        service.writeDataPoint('compilation_request', data);

        assertEquals(dataset.dataPoints.length, 1);
    });

    await t.step('should not write data point when disabled', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService();

        const data: CompilationEventData = {
            requestId: 'test-123',
        };

        service.writeDataPoint('compilation_request', data);

        assertEquals(dataset.dataPoints.length, 0);
    });

    await t.step('should format data point correctly', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        const data: CompilationEventData = {
            requestId: 'test-123',
            configName: 'My Filter',
            durationMs: 1000,
        };

        service.writeDataPoint('compilation_success', data);

        assertEquals(dataset.dataPoints.length, 1);
        const dataPoint = dataset.dataPoints[0];
        assertEquals(dataPoint.indexes !== undefined, true);
        assertEquals(dataPoint.doubles !== undefined, true);
        assertEquals(dataPoint.blobs !== undefined, true);
    });

    await t.step('should handle errors gracefully', () => {
        const faultyDataset: AnalyticsEngineDataset = {
            writeDataPoint: () => {
                throw new Error('Dataset error');
            },
        };
        const service = new AnalyticsService(faultyDataset);

        const data: CompilationEventData = {
            requestId: 'test-123',
        };

        // Should not throw
        service.writeDataPoint('compilation_request', data);
    });
});

Deno.test('AnalyticsService - trackCompilationRequest', async (t) => {
    await t.step('should track compilation request', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        service.trackCompilationRequest({
            requestId: 'test-123',
            configName: 'My Filter',
            sourceCount: 5,
        });

        assertEquals(dataset.dataPoints.length, 1);
    });

    await t.step('should not track when disabled', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService();

        service.trackCompilationRequest({
            requestId: 'test-123',
        });

        assertEquals(dataset.dataPoints.length, 0);
    });
});

Deno.test('AnalyticsService - trackCompilationSuccess', async (t) => {
    await t.step('should track compilation success', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        service.trackCompilationSuccess({
            requestId: 'test-123',
            configName: 'My Filter',
            ruleCount: 1000,
            durationMs: 500,
            outputSizeBytes: 50000,
        });

        assertEquals(dataset.dataPoints.length, 1);
    });
});

Deno.test('AnalyticsService - trackCompilationError', async (t) => {
    await t.step('should track compilation error', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        service.trackCompilationError({
            requestId: 'test-123',
            configName: 'My Filter',
            error: 'Compilation failed',
            durationMs: 100,
        });

        assertEquals(dataset.dataPoints.length, 1);
    });
});

Deno.test('AnalyticsService - trackCacheHit', async (t) => {
    await t.step('should track cache hit', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        service.trackCacheHit({
            requestId: 'test-123',
            cacheKey: 'my-key',
        });

        assertEquals(dataset.dataPoints.length, 1);
    });
});

Deno.test('AnalyticsService - trackCacheMiss', async (t) => {
    await t.step('should track cache miss', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        service.trackCacheMiss({
            requestId: 'test-123',
            cacheKey: 'my-key',
        });

        assertEquals(dataset.dataPoints.length, 1);
    });
});

Deno.test('AnalyticsService - trackSourceFetch', async (t) => {
    await t.step('should track source fetch', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        const data: SourceFetchEventData = {
            requestId: 'test-123',
            sourceUrl: 'https://example.com/filter.txt',
            sourceName: 'Example Filter',
            statusCode: 200,
            durationMs: 250,
            contentSizeBytes: 10000,
        };

        service.trackSourceFetch(data);

        assertEquals(dataset.dataPoints.length, 1);
    });
});

Deno.test('AnalyticsService - trackSourceFetchError', async (t) => {
    await t.step('should track source fetch error', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        const data: SourceFetchEventData = {
            requestId: 'test-123',
            sourceUrl: 'https://example.com/filter.txt',
            error: 'Network error',
            statusCode: 500,
        };

        service.trackSourceFetchError(data);

        assertEquals(dataset.dataPoints.length, 1);
    });
});

Deno.test('AnalyticsService - trackWorkflowStarted', async (t) => {
    await t.step('should track workflow started', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        const data: WorkflowEventData = {
            workflowId: 'wf-123',
            workflowType: 'compilation',
            stepName: 'initialize',
        };

        service.trackWorkflowStarted(data);

        assertEquals(dataset.dataPoints.length, 1);
    });
});

Deno.test('AnalyticsService - trackWorkflowCompleted', async (t) => {
    await t.step('should track workflow completed', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        const data: WorkflowEventData = {
            workflowId: 'wf-123',
            workflowType: 'compilation',
            durationMs: 5000,
            itemCount: 10,
            successCount: 10,
            failedCount: 0,
        };

        service.trackWorkflowCompleted(data);

        assertEquals(dataset.dataPoints.length, 1);
    });
});

Deno.test('AnalyticsService - trackWorkflowFailed', async (t) => {
    await t.step('should track workflow failed', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        const data: WorkflowEventData = {
            workflowId: 'wf-123',
            workflowType: 'compilation',
            error: 'Workflow error',
            durationMs: 1000,
        };

        service.trackWorkflowFailed(data);

        assertEquals(dataset.dataPoints.length, 1);
    });
});

Deno.test('AnalyticsService - trackApiRequest', async (t) => {
    await t.step('should track API request', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        const data: ApiRequestEventData = {
            requestId: 'req-123',
            method: 'POST',
            path: '/api/compile',
            statusCode: 200,
            responseTimeMs: 150,
        };

        service.trackApiRequest(data);

        assertEquals(dataset.dataPoints.length, 1);
    });
});

Deno.test('AnalyticsService - trackRateLimitExceeded', async (t) => {
    await t.step('should track rate limit exceeded', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        const data: RateLimitEventData = {
            requestId: 'req-123',
            clientIpHash: 'hash123',
            requestCount: 100,
            rateLimit: 50,
            windowSeconds: 60,
        };

        service.trackRateLimitExceeded(data);

        assertEquals(dataset.dataPoints.length, 1);
    });
});

Deno.test('AnalyticsService - multiple events', async (t) => {
    await t.step('should track multiple events', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        service.trackCompilationRequest({ requestId: 'test-1' });
        service.trackCacheHit({ requestId: 'test-1' });
        service.trackCompilationSuccess({ requestId: 'test-1', ruleCount: 100 });

        assertEquals(dataset.dataPoints.length, 3);
    });

    await t.step('should handle concurrent events', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        service.trackCompilationRequest({ requestId: 'test-1' });
        service.trackCompilationRequest({ requestId: 'test-2' });
        service.trackCompilationRequest({ requestId: 'test-3' });

        assertEquals(dataset.dataPoints.length, 3);
    });
});

Deno.test('AnalyticsService - edge cases', async (t) => {
    await t.step('should handle empty event data', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        service.trackCompilationRequest({});

        assertEquals(dataset.dataPoints.length, 1);
    });

    await t.step('should handle undefined fields', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        service.trackCompilationSuccess({
            requestId: undefined,
            configName: undefined,
            ruleCount: undefined,
        });

        assertEquals(dataset.dataPoints.length, 1);
    });

    await t.step('should handle very large numbers', () => {
        const dataset = new MockAnalyticsDataset();
        const service = new AnalyticsService(dataset);

        service.trackCompilationSuccess({
            ruleCount: Number.MAX_SAFE_INTEGER,
            durationMs: Number.MAX_SAFE_INTEGER,
            outputSizeBytes: Number.MAX_SAFE_INTEGER,
        });

        assertEquals(dataset.dataPoints.length, 1);
    });
});
