/**
 * Integration tests for the Cloudflare Queue functionality
 *
 * These tests simulate end-to-end queue processing scenarios.
 * They require mocking Cloudflare Workers environment bindings.
 *
 * Note: For actual production testing, deploy to Cloudflare and use
 * their testing tools or wrangler dev mode.
 */

import { assertEquals, assertExists } from '@std/assert';

/**
 * Mock KV Namespace for testing
 */
class MockKVNamespace {
    private store: Map<string, { value: ArrayBuffer | string; expiration?: number }> = new Map();

    async get(key: string, type?: 'text' | 'json' | 'arrayBuffer'): Promise<any> {
        const entry = this.store.get(key);
        if (!entry) return null;

        if (type === 'arrayBuffer' && entry.value instanceof ArrayBuffer) {
            return entry.value;
        }
        if (type === 'json' && typeof entry.value === 'string') {
            return JSON.parse(entry.value);
        }
        if (type === 'text' && typeof entry.value === 'string') {
            return entry.value;
        }
        return entry.value;
    }

    async put(
        key: string,
        value: string | ArrayBuffer,
        options?: { expirationTtl?: number },
    ): Promise<void> {
        this.store.set(key, {
            value,
            expiration: options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : undefined,
        });
    }

    async delete(key: string): Promise<void> {
        this.store.delete(key);
    }

    async list(): Promise<{ keys: Array<{ name: string }> }> {
        return {
            keys: Array.from(this.store.keys()).map((name) => ({ name })),
        };
    }

    // Test helper
    clear(): void {
        this.store.clear();
    }
}

/**
 * Mock Queue for testing
 */
class MockQueue<T = unknown> {
    public messages: T[] = [];

    async send(message: T): Promise<void> {
        this.messages.push(message);
    }

    async sendBatch(messages: T[]): Promise<void> {
        this.messages.push(...messages);
    }

    // Test helpers
    clear(): void {
        this.messages = [];
    }

    get length(): number {
        return this.messages.length;
    }
}

/**
 * Mock Message Batch for queue consumer
 */
class MockMessageBatch<T> {
    constructor(public messages: Array<{ body: T; ack: () => void; retry: () => void }>) {}
}

/**
 * Mock Environment bindings
 */
interface MockEnv {
    COMPILER_VERSION: string;
    COMPILATION_CACHE: MockKVNamespace;
    RATE_LIMIT: MockKVNamespace;
    METRICS: MockKVNamespace;
    ADBLOCK_COMPILER_QUEUE: MockQueue;
}

function createMockEnv(): MockEnv {
    return {
        COMPILER_VERSION: '0.7.7-test',
        COMPILATION_CACHE: new MockKVNamespace(),
        RATE_LIMIT: new MockKVNamespace(),
        METRICS: new MockKVNamespace(),
        ADBLOCK_COMPILER_QUEUE: new MockQueue(),
    };
}

// Integration Tests

Deno.test('Integration - Queue message enqueuing', async () => {
    const env = createMockEnv();

    const message = {
        type: 'compile' as const,
        requestId: 'test-123',
        timestamp: Date.now(),
        configuration: {
            name: 'Test Filter',
            sources: [{ source: 'https://example.com/test.txt' }],
        },
    };

    await env.ADBLOCK_COMPILER_QUEUE.send(message);

    assertEquals(env.ADBLOCK_COMPILER_QUEUE.length, 1);
    assertEquals(env.ADBLOCK_COMPILER_QUEUE.messages[0].type, 'compile');
    assertEquals(env.ADBLOCK_COMPILER_QUEUE.messages[0].requestId, 'test-123');
});

Deno.test('Integration - Batch message enqueuing', async () => {
    const env = createMockEnv();

    const message = {
        type: 'batch-compile' as const,
        requestId: 'batch-456',
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

    await env.ADBLOCK_COMPILER_QUEUE.send(message);

    assertEquals(env.ADBLOCK_COMPILER_QUEUE.length, 1);
    const queuedMessage = env.ADBLOCK_COMPILER_QUEUE.messages[0] as typeof message;
    assertEquals(queuedMessage.type, 'batch-compile');
    assertEquals(queuedMessage.requests.length, 2);
});

Deno.test('Integration - Cache warming message enqueuing', async () => {
    const env = createMockEnv();

    const message = {
        type: 'cache-warm' as const,
        requestId: 'warm-789',
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

    await env.ADBLOCK_COMPILER_QUEUE.send(message);

    assertEquals(env.ADBLOCK_COMPILER_QUEUE.length, 1);
    const queuedMessage = env.ADBLOCK_COMPILER_QUEUE.messages[0] as typeof message;
    assertEquals(queuedMessage.type, 'cache-warm');
    assertEquals(queuedMessage.configurations.length, 2);
});

Deno.test('Integration - Multiple messages enqueuing', async () => {
    const env = createMockEnv();

    const messages = [
        {
            type: 'compile' as const,
            requestId: 'msg-1',
            timestamp: Date.now(),
            configuration: {
                name: 'Filter 1',
                sources: [{ source: 'https://example.com/filter1.txt' }],
            },
        },
        {
            type: 'compile' as const,
            requestId: 'msg-2',
            timestamp: Date.now(),
            configuration: {
                name: 'Filter 2',
                sources: [{ source: 'https://example.com/filter2.txt' }],
            },
        },
        {
            type: 'compile' as const,
            requestId: 'msg-3',
            timestamp: Date.now(),
            configuration: {
                name: 'Filter 3',
                sources: [{ source: 'https://example.com/filter3.txt' }],
            },
        },
    ];

    await env.ADBLOCK_COMPILER_QUEUE.sendBatch(messages);

    assertEquals(env.ADBLOCK_COMPILER_QUEUE.length, 3);
    assertEquals(env.ADBLOCK_COMPILER_QUEUE.messages[0].requestId, 'msg-1');
    assertEquals(env.ADBLOCK_COMPILER_QUEUE.messages[1].requestId, 'msg-2');
    assertEquals(env.ADBLOCK_COMPILER_QUEUE.messages[2].requestId, 'msg-3');
});

Deno.test('Integration - KV cache storage and retrieval', async () => {
    const env = createMockEnv();

    const testData = {
        success: true,
        rules: ['||example.com^', '||ads.example.com^'],
        ruleCount: 2,
        compiledAt: new Date().toISOString(),
    };

    // Store in cache
    await env.COMPILATION_CACHE.put('cache:test-key', JSON.stringify(testData));

    // Retrieve from cache
    const retrieved = await env.COMPILATION_CACHE.get('cache:test-key', 'json');

    assertExists(retrieved);
    assertEquals(retrieved.success, true);
    assertEquals(retrieved.ruleCount, 2);
    assertEquals(retrieved.rules.length, 2);
});

Deno.test('Integration - KV cache with ArrayBuffer', async () => {
    const env = createMockEnv();

    // Simulate compressed data
    const testData = new Uint8Array([1, 2, 3, 4, 5]);
    const arrayBuffer = testData.buffer;

    // Store compressed data
    await env.COMPILATION_CACHE.put('cache:compressed-key', arrayBuffer);

    // Retrieve compressed data
    const retrieved = await env.COMPILATION_CACHE.get('cache:compressed-key', 'arrayBuffer');

    assertExists(retrieved);
    assertEquals(retrieved instanceof ArrayBuffer, true);
    assertEquals(retrieved.byteLength, 5);
});

Deno.test('Integration - Rate limiting storage', async () => {
    const env = createMockEnv();

    const rateLimitData = {
        count: 5,
        resetAt: Date.now() + 60000,
    };

    await env.RATE_LIMIT.put('ratelimit:192.168.1.1', JSON.stringify(rateLimitData));

    const retrieved = await env.RATE_LIMIT.get('ratelimit:192.168.1.1', 'json');

    assertExists(retrieved);
    assertEquals(retrieved.count, 5);
    assertExists(retrieved.resetAt);
});

Deno.test('Integration - Metrics storage', async () => {
    const env = createMockEnv();

    const metricsData = {
        count: 100,
        success: 95,
        failed: 5,
        totalDuration: 12500,
        avgDuration: 125,
        errors: {
            'Network timeout': 3,
            'Invalid configuration': 2,
        },
    };

    await env.METRICS.put('metrics:12345:/compile', JSON.stringify(metricsData));

    const retrieved = await env.METRICS.get('metrics:12345:/compile', 'json');

    assertExists(retrieved);
    assertEquals(retrieved.count, 100);
    assertEquals(retrieved.success, 95);
    assertEquals(retrieved.failed, 5);
    assertEquals(Object.keys(retrieved.errors).length, 2);
});

Deno.test('Integration - Message acknowledgment tracking', () => {
    let ackCount = 0;
    let retryCount = 0;

    const messages = [
        {
            body: {
                type: 'compile' as const,
                requestId: 'test-1',
                timestamp: Date.now(),
                configuration: {
                    name: 'Test',
                    sources: [{ source: 'https://example.com/test.txt' }],
                },
            },
            ack: () => {
                ackCount++;
            },
            retry: () => {
                retryCount++;
            },
        },
    ];

    const batch = new MockMessageBatch(messages);

    // Simulate successful processing
    batch.messages[0].ack();

    assertEquals(ackCount, 1);
    assertEquals(retryCount, 0);
});

Deno.test('Integration - Message retry tracking', () => {
    let ackCount = 0;
    let retryCount = 0;

    const messages = [
        {
            body: {
                type: 'compile' as const,
                requestId: 'test-1',
                timestamp: Date.now(),
                configuration: {
                    name: 'Test',
                    sources: [{ source: 'https://example.com/test.txt' }],
                },
            },
            ack: () => {
                ackCount++;
            },
            retry: () => {
                retryCount++;
            },
        },
    ];

    const batch = new MockMessageBatch(messages);

    // Simulate failed processing
    batch.messages[0].retry();

    assertEquals(ackCount, 0);
    assertEquals(retryCount, 1);
});

Deno.test('Integration - Queue clearing between tests', async () => {
    const env = createMockEnv();

    // Add some messages
    await env.ADBLOCK_COMPILER_QUEUE.send({
        type: 'compile' as const,
        requestId: 'test-1',
        timestamp: Date.now(),
        configuration: {
            name: 'Test',
            sources: [{ source: 'https://example.com/test.txt' }],
        },
    });

    assertEquals(env.ADBLOCK_COMPILER_QUEUE.length, 1);

    // Clear queue
    env.ADBLOCK_COMPILER_QUEUE.clear();

    assertEquals(env.ADBLOCK_COMPILER_QUEUE.length, 0);
});

Deno.test('Integration - Cache clearing between tests', async () => {
    const env = createMockEnv();

    // Add some cache entries
    await env.COMPILATION_CACHE.put('test-1', 'data1');
    await env.COMPILATION_CACHE.put('test-2', 'data2');

    const listBefore = await env.COMPILATION_CACHE.list();
    assertEquals(listBefore.keys.length, 2);

    // Clear cache
    env.COMPILATION_CACHE.clear();

    const listAfter = await env.COMPILATION_CACHE.list();
    assertEquals(listAfter.keys.length, 0);
});

Deno.test('Integration - Simulated queue batch processing', () => {
    let processedCount = 0;
    let ackedCount = 0;
    let retriedCount = 0;

    const messages = Array.from({ length: 10 }, (_, i) => ({
        body: {
            type: 'compile' as const,
            requestId: `test-${i}`,
            timestamp: Date.now(),
            configuration: {
                name: `Filter ${i}`,
                sources: [{ source: `https://example.com/filter${i}.txt` }],
            },
        },
        ack: () => {
            ackedCount++;
        },
        retry: () => {
            retriedCount++;
        },
    }));

    const batch = new MockMessageBatch(messages);

    // Simulate processing
    for (const message of batch.messages) {
        processedCount++;

        // Simulate 80% success rate
        if (Math.random() > 0.2 || processedCount <= 8) {
            message.ack();
        } else {
            message.retry();
        }
    }

    assertEquals(processedCount, 10);
    assertEquals(ackedCount + retriedCount, 10);
});

Deno.test('Integration - Request ID uniqueness across messages', async () => {
    const env = createMockEnv();

    const requestIds = new Set<string>();

    // Generate 100 messages
    for (let i = 0; i < 100; i++) {
        const requestId = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        requestIds.add(requestId);

        await env.ADBLOCK_COMPILER_QUEUE.send({
            type: 'compile' as const,
            requestId,
            timestamp: Date.now(),
            configuration: {
                name: `Filter ${i}`,
                sources: [{ source: `https://example.com/filter${i}.txt` }],
            },
        });
    }

    // All request IDs should be unique
    assertEquals(requestIds.size, 100);
    assertEquals(env.ADBLOCK_COMPILER_QUEUE.length, 100);
});
