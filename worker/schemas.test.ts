/**
 * Tests for worker Zod schemas
 */

import { assertEquals } from '@std/assert';
import {
    AdminAuthResultSchema,
    AdminQueryRequestSchema,
    AggregatedMetricsSchema,
    ASTParseRequestSchema,
    BatchCompilationParamsSchema,
    BatchCompileQueueMessageSchema,
    BatchWorkflowResultSchema,
    CacheWarmingParamsSchema,
    CacheWarmingResultSchema,
    CacheWarmQueueMessageSchema,
    CompilationParamsSchema,
    CompilationResultSchema,
    CompileQueueMessageSchema,
    EndpointMetricsSchema,
    HealthMonitoringParamsSchema,
    HealthMonitoringResultSchema,
    JobHistoryEntrySchema,
    PrioritySchema,
    QueueMessageSchema,
    QueueMessageTypeSchema,
    QueueStatsSchema,
    RateLimitDataSchema,
    StorageStatsSchema,
    TurnstileVerifyResponseSchema,
    WorkflowCompilationResultSchema,
    WorkflowInstanceInfoSchema,
    WorkflowProgressEventSchema,
    WorkflowStatusSchema,
} from './schemas.ts';

Deno.test('PrioritySchema validates priority levels', () => {
    assertEquals(PrioritySchema.safeParse('standard').success, true);
    assertEquals(PrioritySchema.safeParse('high').success, true);
    assertEquals(PrioritySchema.safeParse('invalid').success, false);
});

Deno.test('QueueMessageTypeSchema validates message types', () => {
    assertEquals(QueueMessageTypeSchema.safeParse('compile').success, true);
    assertEquals(QueueMessageTypeSchema.safeParse('batch-compile').success, true);
    assertEquals(QueueMessageTypeSchema.safeParse('cache-warm').success, true);
    assertEquals(QueueMessageTypeSchema.safeParse('invalid').success, false);
});

Deno.test('WorkflowStatusSchema validates workflow statuses', () => {
    assertEquals(WorkflowStatusSchema.safeParse('queued').success, true);
    assertEquals(WorkflowStatusSchema.safeParse('running').success, true);
    assertEquals(WorkflowStatusSchema.safeParse('completed').success, true);
    assertEquals(WorkflowStatusSchema.safeParse('failed').success, true);
    assertEquals(WorkflowStatusSchema.safeParse('paused').success, true);
    assertEquals(WorkflowStatusSchema.safeParse('terminated').success, true);
    assertEquals(WorkflowStatusSchema.safeParse('invalid').success, false);
});

Deno.test('ASTParseRequestSchema validates AST parse requests', () => {
    // Valid with rules
    const withRules = { rules: ['||example.com^', '||ads.com^'] };
    assertEquals(ASTParseRequestSchema.safeParse(withRules).success, true);

    // Valid with text
    const withText = { text: '||example.com^\n||ads.com^' };
    assertEquals(ASTParseRequestSchema.safeParse(withText).success, true);

    // Invalid without rules or text
    const invalid = {};
    assertEquals(ASTParseRequestSchema.safeParse(invalid).success, false);
});

Deno.test('AdminQueryRequestSchema validates admin queries', () => {
    const valid = { sql: 'SELECT * FROM table' };
    assertEquals(AdminQueryRequestSchema.safeParse(valid).success, true);

    const invalid = { sql: '' };
    assertEquals(AdminQueryRequestSchema.safeParse(invalid).success, false);
});

Deno.test('CompileQueueMessageSchema validates compile queue messages', () => {
    const valid = {
        type: 'compile',
        timestamp: Date.now(),
        configuration: {
            name: 'Test List',
            sources: [{ source: 'https://example.com/list.txt' }],
        },
    };
    assertEquals(CompileQueueMessageSchema.safeParse(valid).success, true);

    const invalid = {
        type: 'compile',
        timestamp: Date.now(),
        // Missing configuration
    };
    assertEquals(CompileQueueMessageSchema.safeParse(invalid).success, false);
});

Deno.test('BatchCompileQueueMessageSchema validates batch queue messages', () => {
    const valid = {
        type: 'batch-compile',
        timestamp: Date.now(),
        requests: [
            {
                id: 'req-1',
                configuration: {
                    name: 'List 1',
                    sources: [{ source: 'https://example.com/list1.txt' }],
                },
            },
        ],
    };
    assertEquals(BatchCompileQueueMessageSchema.safeParse(valid).success, true);

    const invalid = {
        type: 'batch-compile',
        timestamp: Date.now(),
        requests: [], // Empty array
    };
    assertEquals(BatchCompileQueueMessageSchema.safeParse(invalid).success, false);
});

Deno.test('CacheWarmQueueMessageSchema validates cache warm messages', () => {
    const valid = {
        type: 'cache-warm',
        timestamp: Date.now(),
        configurations: [
            {
                name: 'List 1',
                sources: [{ source: 'https://example.com/list.txt' }],
            },
        ],
    };
    assertEquals(CacheWarmQueueMessageSchema.safeParse(valid).success, true);

    const invalid = {
        type: 'cache-warm',
        timestamp: Date.now(),
        configurations: [], // Empty array
    };
    assertEquals(CacheWarmQueueMessageSchema.safeParse(invalid).success, false);
});

Deno.test('QueueMessageSchema validates all message types with discriminated union', () => {
    const compileMsg = {
        type: 'compile',
        timestamp: Date.now(),
        configuration: {
            name: 'Test',
            sources: [{ source: 'https://example.com/list.txt' }],
        },
    };
    assertEquals(QueueMessageSchema.safeParse(compileMsg).success, true);

    const batchMsg = {
        type: 'batch-compile',
        timestamp: Date.now(),
        requests: [
            {
                id: 'req-1',
                configuration: { name: 'Test', sources: [{ source: 'https://example.com/list.txt' }] },
            },
        ],
    };
    assertEquals(QueueMessageSchema.safeParse(batchMsg).success, true);
});

Deno.test('CompilationParamsSchema validates compilation parameters', () => {
    const valid = {
        requestId: 'req-123',
        configuration: {
            name: 'Test',
            sources: [{ source: 'https://example.com/list.txt' }],
        },
        queuedAt: Date.now(),
    };
    assertEquals(CompilationParamsSchema.safeParse(valid).success, true);

    const invalid = {
        requestId: '', // Empty string
        configuration: { name: 'Test', sources: [{ source: 'https://example.com/list.txt' }] },
        queuedAt: Date.now(),
    };
    assertEquals(CompilationParamsSchema.safeParse(invalid).success, false);
});

Deno.test('TurnstileVerifyResponseSchema validates Turnstile responses', () => {
    const valid = {
        success: true,
        challenge_ts: '2024-01-01T00:00:00Z',
        hostname: 'example.com',
    };
    assertEquals(TurnstileVerifyResponseSchema.safeParse(valid).success, true);

    const withErrors = {
        success: false,
        'error-codes': ['invalid-input-response'],
    };
    assertEquals(TurnstileVerifyResponseSchema.safeParse(withErrors).success, true);
});

Deno.test('RateLimitDataSchema validates rate limit data', () => {
    const valid = {
        count: 5,
        resetAt: Date.now(),
    };
    assertEquals(RateLimitDataSchema.safeParse(valid).success, true);

    const invalid = {
        count: -1, // Negative count
        resetAt: Date.now(),
    };
    assertEquals(RateLimitDataSchema.safeParse(invalid).success, false);
});

Deno.test('EndpointMetricsSchema validates endpoint metrics', () => {
    const valid = {
        count: 100,
        success: 95,
        failed: 5,
        totalDuration: 1500.5,
        errors: { 'timeout': 3, 'network': 2 },
    };
    assertEquals(EndpointMetricsSchema.safeParse(valid).success, true);
});

Deno.test('QueueStatsSchema validates queue statistics', () => {
    const valid = {
        pending: 10,
        completed: 100,
        failed: 5,
        cancelled: 2,
        totalProcessingTime: 5000,
        averageProcessingTime: 50,
        processingRate: 2.5,
        queueLag: 100,
        lastUpdate: new Date().toISOString(),
        history: [],
        depthHistory: [],
    };
    assertEquals(QueueStatsSchema.safeParse(valid).success, true);
});

Deno.test('JobHistoryEntrySchema validates job history entries', () => {
    const valid = {
        requestId: 'req-123',
        configName: 'Test List',
        status: 'completed',
        duration: 1234.5,
        timestamp: new Date().toISOString(),
        ruleCount: 1000,
    };
    assertEquals(JobHistoryEntrySchema.safeParse(valid).success, true);

    const invalid = {
        requestId: 'req-123',
        configName: 'Test List',
        status: 'invalid-status', // Invalid status
        duration: 1234.5,
        timestamp: new Date().toISOString(),
    };
    assertEquals(JobHistoryEntrySchema.safeParse(invalid).success, false);
});

Deno.test('AdminAuthResultSchema validates admin auth results', () => {
    const authorized = { authorized: true };
    assertEquals(AdminAuthResultSchema.safeParse(authorized).success, true);

    const unauthorized = { authorized: false, error: 'Invalid key' };
    assertEquals(AdminAuthResultSchema.safeParse(unauthorized).success, true);
});

Deno.test('StorageStatsSchema validates storage statistics', () => {
    const valid = {
        storage_entries: 100,
        filter_cache: 50,
        compilation_metadata: 30,
        expired_storage: 10,
        expired_cache: 5,
    };
    assertEquals(StorageStatsSchema.safeParse(valid).success, true);
});

Deno.test('CompilationResultSchema validates compilation results', () => {
    const success = {
        success: true,
        rules: ['||example.com^', '||ads.com^'],
        ruleCount: 2,
        compiledAt: new Date().toISOString(),
        cached: false,
    };
    assertEquals(CompilationResultSchema.safeParse(success).success, true);

    const failure = {
        success: false,
        error: 'Compilation failed',
    };
    assertEquals(CompilationResultSchema.safeParse(failure).success, true);
});

Deno.test('WorkflowCompilationResultSchema validates workflow results', () => {
    const valid = {
        success: true,
        requestId: 'req-123',
        configName: 'Test List',
        rules: ['||example.com^'],
        ruleCount: 1,
        compiledAt: new Date().toISOString(),
        totalDurationMs: 1500,
        steps: {
            validation: { durationMs: 100, success: true },
            sourceFetch: {
                durationMs: 500,
                sources: [
                    {
                        name: 'Source 1',
                        url: 'https://example.com/list.txt',
                        success: true,
                        durationMs: 500,
                        cached: false,
                    },
                ],
            },
        },
    };
    assertEquals(WorkflowCompilationResultSchema.safeParse(valid).success, true);
});

Deno.test('HealthMonitoringParamsSchema validates health monitoring params', () => {
    const valid = {
        runId: 'run-123',
        sources: [
            {
                name: 'Source 1',
                url: 'https://example.com/list.txt',
                expectedMinRules: 100,
            },
        ],
        alertOnFailure: true,
    };
    assertEquals(HealthMonitoringParamsSchema.safeParse(valid).success, true);

    const invalid = {
        runId: 'run-123',
        sources: [], // Empty sources
        alertOnFailure: true,
    };
    assertEquals(HealthMonitoringParamsSchema.safeParse(invalid).success, false);
});

Deno.test('WorkflowProgressEventSchema validates workflow events', () => {
    const valid = {
        type: 'workflow:started',
        workflowId: 'wf-123',
        workflowType: 'compilation',
        timestamp: new Date().toISOString(),
        progress: 0,
        message: 'Starting compilation',
    };
    assertEquals(WorkflowProgressEventSchema.safeParse(valid).success, true);

    const invalidProgress = {
        type: 'workflow:progress',
        workflowId: 'wf-123',
        workflowType: 'compilation',
        timestamp: new Date().toISOString(),
        progress: 150, // Invalid: > 100
    };
    assertEquals(WorkflowProgressEventSchema.safeParse(invalidProgress).success, false);
});

Deno.test('WorkflowInstanceInfoSchema validates workflow instance info', () => {
    const valid = {
        id: 'wf-123',
        workflowName: 'compilation',
        status: 'running',
        createdAt: new Date().toISOString(),
        params: { requestId: 'req-123' },
    };
    assertEquals(WorkflowInstanceInfoSchema.safeParse(valid).success, true);
});

// Tests for previously uncovered schemas

Deno.test('BatchCompilationParamsSchema validates batch compilation params', () => {
    const valid = {
        batchId: 'batch-123',
        requests: [
            {
                id: 'req-1',
                configuration: {
                    name: 'List 1',
                    sources: [{ source: 'https://example.com/list1.txt' }],
                },
            },
            {
                id: 'req-2',
                configuration: {
                    name: 'List 2',
                    sources: [{ source: 'https://example.com/list2.txt' }],
                },
            },
        ],
        priority: 'high',
        queuedAt: Date.now(),
    };
    assertEquals(BatchCompilationParamsSchema.safeParse(valid).success, true);

    const invalid = {
        batchId: 'batch-123',
        requests: [], // Empty requests
        queuedAt: Date.now(),
    };
    assertEquals(BatchCompilationParamsSchema.safeParse(invalid).success, false);
});

Deno.test('CacheWarmingParamsSchema validates cache warming params', () => {
    const valid = {
        runId: 'run-123',
        configurations: [
            {
                name: 'List 1',
                sources: [{ source: 'https://example.com/list.txt' }],
            },
        ],
        scheduled: true,
    };
    assertEquals(CacheWarmingParamsSchema.safeParse(valid).success, true);

    const invalid = {
        runId: 'run-123',
        configurations: [], // Empty configurations
        scheduled: true,
    };
    assertEquals(CacheWarmingParamsSchema.safeParse(invalid).success, false);
});

Deno.test('AggregatedMetricsSchema validates aggregated metrics', () => {
    const valid = {
        window: '1h',
        timestamp: new Date().toISOString(),
        endpoints: {
            '/api/compile': {
                count: 100,
                success: 95,
                failed: 5,
                avgDuration: 150.5,
                errors: { 'timeout': 3, 'validation': 2 },
            },
        },
    };
    assertEquals(AggregatedMetricsSchema.safeParse(valid).success, true);
});

Deno.test('BatchWorkflowResultSchema validates batch workflow results', () => {
    const valid = {
        batchId: 'batch-123',
        totalRequests: 2,
        successful: 2,
        failed: 0,
        results: [
            {
                success: true,
                requestId: 'req-1',
                configName: 'List 1',
                compiledAt: new Date().toISOString(),
                totalDurationMs: 1000,
                steps: {},
            },
            {
                success: true,
                requestId: 'req-2',
                configName: 'List 2',
                compiledAt: new Date().toISOString(),
                totalDurationMs: 1200,
                steps: {},
            },
        ],
        totalDurationMs: 2200,
    };
    assertEquals(BatchWorkflowResultSchema.safeParse(valid).success, true);
});

Deno.test('HealthMonitoringResultSchema validates health monitoring results', () => {
    const valid = {
        runId: 'run-123',
        sourcesChecked: 3,
        healthySources: 2,
        unhealthySources: 1,
        results: [
            {
                name: 'Source 1',
                url: 'https://example.com/list1.txt',
                healthy: true,
                statusCode: 200,
                responseTimeMs: 150,
                ruleCount: 1000,
                lastChecked: new Date().toISOString(),
            },
            {
                name: 'Source 2',
                url: 'https://example.com/list2.txt',
                healthy: false,
                error: 'Connection timeout',
                lastChecked: new Date().toISOString(),
            },
        ],
        alertsSent: true,
        totalDurationMs: 500,
    };
    assertEquals(HealthMonitoringResultSchema.safeParse(valid).success, true);
});

Deno.test('CacheWarmingResultSchema validates cache warming results', () => {
    const valid = {
        runId: 'run-123',
        scheduled: true,
        warmedConfigurations: 5,
        failedConfigurations: 1,
        details: [
            {
                configName: 'List 1',
                success: true,
                cacheKey: 'cache-key-1',
            },
            {
                configName: 'List 2',
                success: false,
                error: 'Download failed',
            },
        ],
        totalDurationMs: 3000,
    };
    assertEquals(CacheWarmingResultSchema.safeParse(valid).success, true);
});
