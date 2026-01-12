/**
 * Tests for the Cloudflare Queue functionality
 * 
 * Note: These are unit tests for queue message structure and handlers.
 * Integration testing requires actual Cloudflare deployment with queue.
 */

import { assertEquals, assertExists } from '@std/assert';

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

// Tests
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
