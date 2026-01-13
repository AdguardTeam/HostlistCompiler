/**
 * Tests for the Cloudflare Queue functionality
 *
 * Note: These are unit tests for queue message structure and handlers.
 * Integration testing requires actual Cloudflare deployment with queue.
 */

import { assertEquals, assertExists, assertNotEquals } from '@std/assert';

/**
 * Priority levels for queue messages
 */
type Priority = 'standard' | 'high';

/**
 * Queue message types for different operations
 */
type QueueMessageType = 'compile' | 'batch-compile' | 'cache-warm';

/**
 * Base queue message structure
 */
interface QueueMessage {
    type: QueueMessageType;
    requestId?: string;
    timestamp: number;
    priority?: Priority;
}

/**
 * Queue message for single compilation
 */
interface CompileQueueMessage extends QueueMessage {
    type: 'compile';
    configuration: {
        name: string;
        sources: Array<{ source: string }>;
    };
    preFetchedContent?: Record<string, string>;
    benchmark?: boolean;
}

/**
 * Queue message for batch compilation
 */
interface BatchCompileQueueMessage extends QueueMessage {
    type: 'batch-compile';
    requests: Array<{
        id: string;
        configuration: {
            name: string;
            sources: Array<{ source: string }>;
        };
        preFetchedContent?: Record<string, string>;
        benchmark?: boolean;
    }>;
}

/**
 * Queue message for cache warming
 */
interface CacheWarmQueueMessage extends QueueMessage {
    type: 'cache-warm';
    configurations: Array<{
        name: string;
        sources: Array<{ source: string }>;
    }>;
}

/**
 * Helper to generate request ID
 */
function generateRequestId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Helper to create a mock compile message
 */
function createMockCompileMessage(name: string = 'Test Filter', priority?: Priority): CompileQueueMessage {
    return {
        type: 'compile',
        requestId: generateRequestId('test'),
        timestamp: Date.now(),
        configuration: {
            name,
            sources: [{ source: 'https://example.com/filters.txt' }],
        },
        priority,
    };
}

// Message Structure Tests
Deno.test('Queue Message - compile message has correct structure', () => {
    const message: CompileQueueMessage = {
        type: 'compile',
        requestId: 'test-123',
        timestamp: Date.now(),
        configuration: {
            name: 'Test Filter',
            sources: [{ source: 'https://example.com/filters.txt' }],
        },
    };

    assertEquals(message.type, 'compile');
    assertExists(message.requestId);
    assertExists(message.timestamp);
    assertExists(message.configuration);
    assertEquals(message.configuration.name, 'Test Filter');
});

Deno.test('Queue Message - batch compile message has correct structure', () => {
    const message: BatchCompileQueueMessage = {
        type: 'batch-compile',
        requestId: 'batch-123',
        timestamp: Date.now(),
        requests: [
            {
                id: 'req-1',
                configuration: {
                    name: 'Filter 1',
                    sources: [{ source: 'https://example.com/filter1.txt' }],
                },
            },
            {
                id: 'req-2',
                configuration: {
                    name: 'Filter 2',
                    sources: [{ source: 'https://example.com/filter2.txt' }],
                },
            },
        ],
    };

    assertEquals(message.type, 'batch-compile');
    assertEquals(message.requests.length, 2);
    assertEquals(message.requests[0].id, 'req-1');
    assertEquals(message.requests[1].id, 'req-2');
});

Deno.test('Queue Message - cache warm message has correct structure', () => {
    const message: CacheWarmQueueMessage = {
        type: 'cache-warm',
        requestId: 'warm-123',
        timestamp: Date.now(),
        configurations: [
            {
                name: 'Popular Filter 1',
                sources: [{ source: 'https://example.com/popular1.txt' }],
            },
            {
                name: 'Popular Filter 2',
                sources: [{ source: 'https://example.com/popular2.txt' }],
            },
        ],
    };

    assertEquals(message.type, 'cache-warm');
    assertEquals(message.configurations.length, 2);
    assertEquals(message.configurations[0].name, 'Popular Filter 1');
});

Deno.test('Queue Message - compile message with optional fields', () => {
    const message: CompileQueueMessage = {
        type: 'compile',
        requestId: 'test-456',
        timestamp: Date.now(),
        configuration: {
            name: 'Test Filter',
            sources: [{ source: 'https://example.com/filters.txt' }],
        },
        preFetchedContent: {
            'https://example.com/filters.txt': '||example.com^',
        },
        benchmark: true,
    };

    assertEquals(message.type, 'compile');
    assertExists(message.preFetchedContent);
    assertEquals(message.benchmark, true);
    assertExists(message.preFetchedContent['https://example.com/filters.txt']);
});

// Request ID Generation Tests
Deno.test('generateRequestId - should generate unique IDs', () => {
    const id1 = generateRequestId('test');
    const id2 = generateRequestId('test');

    assertExists(id1);
    assertExists(id2);
    assertNotEquals(id1, id2); // Should be unique
});

Deno.test('generateRequestId - should include prefix', () => {
    const id = generateRequestId('compile');

    assertExists(id);
    assertEquals(id.startsWith('compile-'), true);
});

Deno.test('generateRequestId - should handle different prefixes', () => {
    const compileId = generateRequestId('compile');
    const batchId = generateRequestId('batch');
    const warmId = generateRequestId('cache-warm');

    assertEquals(compileId.startsWith('compile-'), true);
    assertEquals(batchId.startsWith('batch-'), true);
    assertEquals(warmId.startsWith('cache-warm-'), true);
});

// Message Validation Tests
Deno.test('Queue Message - compile message requires configuration', () => {
    const message: CompileQueueMessage = {
        type: 'compile',
        requestId: 'test-789',
        timestamp: Date.now(),
        configuration: {
            name: 'Required Config',
            sources: [{ source: 'https://example.com/test.txt' }],
        },
    };

    assertExists(message.configuration);
    assertExists(message.configuration.name);
    assertExists(message.configuration.sources);
    assertEquals(message.configuration.sources.length > 0, true);
});

Deno.test('Queue Message - batch message can have empty requests array', () => {
    const message: BatchCompileQueueMessage = {
        type: 'batch-compile',
        requestId: 'batch-empty',
        timestamp: Date.now(),
        requests: [],
    };

    assertEquals(message.requests.length, 0);
});

Deno.test('Queue Message - batch message with single request', () => {
    const message: BatchCompileQueueMessage = {
        type: 'batch-compile',
        requestId: 'batch-single',
        timestamp: Date.now(),
        requests: [
            {
                id: 'single-req',
                configuration: {
                    name: 'Single Filter',
                    sources: [{ source: 'https://example.com/single.txt' }],
                },
            },
        ],
    };

    assertEquals(message.requests.length, 1);
    assertEquals(message.requests[0].id, 'single-req');
});

Deno.test('Queue Message - batch message with maximum requests', () => {
    const requests = Array.from({ length: 100 }, (_, i) => ({
        id: `req-${i}`,
        configuration: {
            name: `Filter ${i}`,
            sources: [{ source: `https://example.com/filter${i}.txt` }],
        },
    }));

    const message: BatchCompileQueueMessage = {
        type: 'batch-compile',
        requestId: 'batch-max',
        timestamp: Date.now(),
        requests,
    };

    assertEquals(message.requests.length, 100);
    assertEquals(message.requests[0].id, 'req-0');
    assertEquals(message.requests[99].id, 'req-99');
});

// Timestamp Tests
Deno.test('Queue Message - timestamp should be recent', () => {
    const now = Date.now();
    const message = createMockCompileMessage();

    assertExists(message.timestamp);
    // Timestamp should be within last second
    assertEquals(message.timestamp >= now - 1000, true);
    assertEquals(message.timestamp <= now + 1000, true);
});

// Helper Function Tests
Deno.test('createMockCompileMessage - should create valid message', () => {
    const message = createMockCompileMessage();

    assertEquals(message.type, 'compile');
    assertExists(message.requestId);
    assertExists(message.timestamp);
    assertExists(message.configuration);
    assertEquals(message.configuration.name, 'Test Filter');
});

Deno.test('createMockCompileMessage - should accept custom name', () => {
    const message = createMockCompileMessage('Custom Filter');

    assertEquals(message.configuration.name, 'Custom Filter');
});

// Cache Warm Message Edge Cases
Deno.test('Queue Message - cache warm with single configuration', () => {
    const message: CacheWarmQueueMessage = {
        type: 'cache-warm',
        requestId: 'warm-single',
        timestamp: Date.now(),
        configurations: [
            {
                name: 'Single Config',
                sources: [{ source: 'https://example.com/single.txt' }],
            },
        ],
    };

    assertEquals(message.configurations.length, 1);
    assertEquals(message.configurations[0].name, 'Single Config');
});

Deno.test('Queue Message - cache warm with multiple sources per config', () => {
    const message: CacheWarmQueueMessage = {
        type: 'cache-warm',
        requestId: 'warm-multi-source',
        timestamp: Date.now(),
        configurations: [
            {
                name: 'Multi Source Filter',
                sources: [
                    { source: 'https://example.com/filter1.txt' },
                    { source: 'https://example.com/filter2.txt' },
                    { source: 'https://example.com/filter3.txt' },
                ],
            },
        ],
    };

    assertEquals(message.configurations.length, 1);
    assertEquals(message.configurations[0].sources.length, 3);
});

// Pre-fetched Content Tests
Deno.test('Queue Message - compile with pre-fetched content', () => {
    const message: CompileQueueMessage = {
        type: 'compile',
        requestId: 'test-prefetch',
        timestamp: Date.now(),
        configuration: {
            name: 'Pre-fetched Filter',
            sources: [{ source: 'https://example.com/filters.txt' }],
        },
        preFetchedContent: {
            'https://example.com/filters.txt': '||ads.example.com^\n||tracker.example.com^',
        },
    };

    assertExists(message.preFetchedContent);
    assertEquals(
        message.preFetchedContent['https://example.com/filters.txt'],
        '||ads.example.com^\n||tracker.example.com^',
    );
});

Deno.test('Queue Message - compile with multiple pre-fetched sources', () => {
    const message: CompileQueueMessage = {
        type: 'compile',
        requestId: 'test-multi-prefetch',
        timestamp: Date.now(),
        configuration: {
            name: 'Multi Pre-fetched Filter',
            sources: [
                { source: 'https://example.com/filter1.txt' },
                { source: 'https://example.com/filter2.txt' },
            ],
        },
        preFetchedContent: {
            'https://example.com/filter1.txt': '||ads.example.com^',
            'https://example.com/filter2.txt': '||tracker.example.com^',
        },
    };

    assertExists(message.preFetchedContent);
    assertEquals(Object.keys(message.preFetchedContent).length, 2);
    assertExists(message.preFetchedContent['https://example.com/filter1.txt']);
    assertExists(message.preFetchedContent['https://example.com/filter2.txt']);
});

// Benchmark Flag Tests
Deno.test('Queue Message - compile with benchmark enabled', () => {
    const message = createMockCompileMessage();
    message.benchmark = true;

    assertEquals(message.benchmark, true);
});

Deno.test('Queue Message - compile with benchmark disabled', () => {
    const message = createMockCompileMessage();
    message.benchmark = false;

    assertEquals(message.benchmark, false);
});

Deno.test('Queue Message - compile with benchmark undefined (default)', () => {
    const message = createMockCompileMessage();

    assertEquals(message.benchmark, undefined);
});

// Type Discrimination Tests
Deno.test('Queue Message - type field correctly discriminates message types', () => {
    const compileMsg: CompileQueueMessage = createMockCompileMessage();
    const batchMsg: BatchCompileQueueMessage = {
        type: 'batch-compile',
        requestId: 'batch-test',
        timestamp: Date.now(),
        requests: [],
    };
    const warmMsg: CacheWarmQueueMessage = {
        type: 'cache-warm',
        requestId: 'warm-test',
        timestamp: Date.now(),
        configurations: [],
    };

    assertEquals(compileMsg.type, 'compile');
    assertEquals(batchMsg.type, 'batch-compile');
    assertEquals(warmMsg.type, 'cache-warm');
});

// Priority Tests
Deno.test('Queue Message - compile message with standard priority', () => {
    const message: CompileQueueMessage = {
        type: 'compile',
        requestId: 'test-standard',
        timestamp: Date.now(),
        configuration: {
            name: 'Standard Priority Filter',
            sources: [{ source: 'https://example.com/filters.txt' }],
        },
        priority: 'standard',
    };

    assertEquals(message.priority, 'standard');
});

Deno.test('Queue Message - compile message with high priority', () => {
    const message: CompileQueueMessage = {
        type: 'compile',
        requestId: 'test-high',
        timestamp: Date.now(),
        configuration: {
            name: 'High Priority Filter',
            sources: [{ source: 'https://example.com/filters.txt' }],
        },
        priority: 'high',
    };

    assertEquals(message.priority, 'high');
});

Deno.test('Queue Message - compile message with undefined priority defaults to standard', () => {
    const message: CompileQueueMessage = {
        type: 'compile',
        requestId: 'test-default',
        timestamp: Date.now(),
        configuration: {
            name: 'Default Priority Filter',
            sources: [{ source: 'https://example.com/filters.txt' }],
        },
    };

    // Priority is optional, undefined should be valid
    assertEquals(message.priority, undefined);
});

Deno.test('Queue Message - batch message with high priority', () => {
    const message: BatchCompileQueueMessage = {
        type: 'batch-compile',
        requestId: 'batch-high',
        timestamp: Date.now(),
        requests: [
            {
                id: 'req-1',
                configuration: {
                    name: 'Filter 1',
                    sources: [{ source: 'https://example.com/filter1.txt' }],
                },
            },
        ],
        priority: 'high',
    };

    assertEquals(message.priority, 'high');
    assertEquals(message.requests.length, 1);
});

Deno.test('Queue Message - cache warm message with high priority', () => {
    const message: CacheWarmQueueMessage = {
        type: 'cache-warm',
        requestId: 'warm-high',
        timestamp: Date.now(),
        configurations: [
            {
                name: 'Popular Filter',
                sources: [{ source: 'https://example.com/popular.txt' }],
            },
        ],
        priority: 'high',
    };

    assertEquals(message.priority, 'high');
    assertEquals(message.configurations.length, 1);
});

Deno.test('createMockCompileMessage - should support priority parameter', () => {
    const standardMsg = createMockCompileMessage('Test', 'standard');
    const highMsg = createMockCompileMessage('Test', 'high');
    const noPriorityMsg = createMockCompileMessage('Test');

    assertEquals(standardMsg.priority, 'standard');
    assertEquals(highMsg.priority, 'high');
    assertEquals(noPriorityMsg.priority, undefined);
});

Deno.test('Queue Message - priority field is properly typed', () => {
    const message: CompileQueueMessage = {
        type: 'compile',
        requestId: 'test-typed',
        timestamp: Date.now(),
        configuration: {
            name: 'Typed Priority Filter',
            sources: [{ source: 'https://example.com/filters.txt' }],
        },
        priority: 'high',
    };

    // Type assertion to verify Priority type
    const priority: Priority = message.priority!;
    assertEquals(priority === 'high' || priority === 'standard', true);
});
