/**
 * End-to-End API Tests
 *
 * These tests require a running server instance.
 * Run with: deno task dev (in separate terminal)
 * Then: deno test --allow-net worker/api.e2e.test.ts
 *
 * Tests cover:
 * - Core API endpoints (GET /api, GET /metrics, POST /compile, POST /compile/batch)
 * - Streaming endpoints (POST /compile/stream)
 * - Queue endpoints (GET /queue/stats, POST /compile/async, etc.)
 * - Performance and error handling
 */

import { assertEquals, assertExists, assertStringIncludes } from '@std/assert';

// Configuration
let BASE_URL = 'http://localhost:8787';
try {
    BASE_URL = Deno.env.get('E2E_BASE_URL') || BASE_URL;
} catch {
    // Env access not granted, use default
}
const TIMEOUT_MS = 10000; // 10 second timeout for tests

/**
 * Utility to fetch with timeout
 */
async function fetchWithTimeout(url: string, options?: RequestInit, timeoutMs = TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Check if server is available
 */
async function isServerAvailable(): Promise<boolean> {
    try {
        const response = await fetchWithTimeout(`${BASE_URL}/api`, undefined, 5000);
        return response.ok;
    } catch {
        return false;
    }
}

// Skip all tests if server is not available
const serverAvailable = await isServerAvailable();

if (!serverAvailable) {
    console.warn(`⚠️  Server not available at ${BASE_URL}`);
    console.warn('   Start the server with: deno task dev');
    console.warn('   Or set E2E_BASE_URL environment variable');
}

// ============================================================================
// Core API Tests
// ============================================================================

Deno.test({
    name: 'E2E: GET /api - returns API information',
    ignore: !serverAvailable,
    fn: async () => {
        const response = await fetchWithTimeout(`${BASE_URL}/api`);

        assertEquals(response.status, 200);
        const contentType = response.headers.get('content-type');
        if (contentType) {
            assertStringIncludes(contentType, 'application/json');
        }

        const data = (await response.json()) as any;

        assertExists(data.name);
        assertExists(data.version);
        assertExists(data.endpoints);

        // Verify endpoints structure
        assertStringIncludes(JSON.stringify(data.endpoints), '/compile');
        assertStringIncludes(JSON.stringify(data.endpoints), '/metrics');
    },
});

Deno.test({
    name: 'E2E: GET /api/version - returns version information',
    ignore: !serverAvailable,
    fn: async () => {
        const response = await fetchWithTimeout(`${BASE_URL}/api/version`);

        assertEquals(response.status, 200);

        const data = (await response.json()) as any;

        assertExists(data.success);
        if (data.success) {
            assertExists(data.data);
            if (typeof data.data === 'object' && data.data.version) {
                assertExists(data.data.version);
            }
        } else {
            // In case of error, should have version field
            assertExists(data.version);
        }
    },
});

Deno.test({
    name: 'E2E: GET /metrics - returns metrics data',
    ignore: !serverAvailable,
    fn: async () => {
        const response = await fetchWithTimeout(`${BASE_URL}/metrics`);

        assertEquals(response.status, 200);
        const contentType = response.headers.get('content-type');
        if (contentType) {
            assertStringIncludes(contentType, 'application/json');
        }

        const data = (await response.json()) as any;

        assertExists(data.window);
        assertExists(data.endpoints);

        // Check structure
        if (data.endpoints['/compile']) {
            assertExists(data.endpoints['/compile'].count);
        }
    },
});

Deno.test({
    name: 'E2E: POST /compile - simple compilation',
    ignore: !serverAvailable,
    fn: async () => {
        const body = {
            configuration: {
                name: 'E2E Test',
                sources: [{ source: 'test' }],
            },
            preFetchedContent: {
                test: '||example.com^',
            },
        };

        const response = await fetchWithTimeout(`${BASE_URL}/compile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        assertEquals(response.status, 200);

        const data = (await response.json()) as any;

        assertEquals(data.success, true);
        assertExists(data.rules);
        assertExists(data.ruleCount);
        assertEquals(data.ruleCount, 1);
        assertStringIncludes(data.rules[0], '||example.com^');
    },
});

Deno.test({
    name: 'E2E: POST /compile - with transformations',
    ignore: !serverAvailable,
    fn: async () => {
        const body = {
            configuration: {
                name: 'Transform Test',
                sources: [{ source: 'test' }],
                transformations: ['Deduplicate', 'RemoveEmptyLines'],
            },
            preFetchedContent: {
                test: '||ads.com^\n||ads.com^\n\n||tracking.com^',
            },
        };

        const response = await fetchWithTimeout(`${BASE_URL}/compile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        assertEquals(response.status, 200);

        const data = (await response.json()) as any;

        assertEquals(data.success, true);
        assertEquals(data.ruleCount, 2); // Deduplication should reduce to 2 rules
    },
});

Deno.test({
    name: 'E2E: POST /compile - cache behavior',
    ignore: !serverAvailable,
    fn: async () => {
        const body = {
            configuration: {
                name: 'Cache Test',
                sources: [{ source: 'cache-test' }],
            },
            preFetchedContent: {
                'cache-test': '||cache.com^',
            },
        };

        // First request
        const response1 = await fetchWithTimeout(`${BASE_URL}/compile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        assertEquals(response1.status, 200);

        // Second request (should potentially hit cache)
        const response2 = await fetchWithTimeout(`${BASE_URL}/compile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        assertEquals(response2.status, 200);

        const data2 = (await response2.json()) as any;
        assertEquals(data2.success, true);

        // Note: Cache header may or may not be present depending on implementation
        const cacheHeader = response2.headers.get('X-Cache');
        console.log(`   Cache header: ${cacheHeader || 'not present'}`);
    },
});

Deno.test({
    name: 'E2E: POST /compile/batch - batch compilation',
    ignore: !serverAvailable,
    fn: async () => {
        const body = {
            requests: [
                {
                    id: 'batch1',
                    configuration: { name: 'B1', sources: [{ source: 's1' }] },
                    preFetchedContent: { s1: '||b1.com^' },
                },
                {
                    id: 'batch2',
                    configuration: { name: 'B2', sources: [{ source: 's2' }] },
                    preFetchedContent: { s2: '||b2.com^' },
                },
            ],
        };

        const response = await fetchWithTimeout(`${BASE_URL}/compile/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        assertEquals(response.status, 200);

        const data = (await response.json()) as any;

        assertEquals(data.success, true);
        assertExists(data.results);
        assertEquals(data.results.length, 2);

        // Check each result
        for (const result of data.results) {
            assertEquals(result.success, true);
            assertExists(result.id);
        }
    },
});

Deno.test({
    name: 'E2E: POST /compile - error handling for invalid configuration',
    ignore: !serverAvailable,
    fn: async () => {
        const body = {
            configuration: {
                // Missing required 'name' field
                sources: [],
            },
        };

        const response = await fetchWithTimeout(`${BASE_URL}/compile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        // Should return error (400 or 500)
        assertEquals(response.status >= 400, true);
    },
});

// ============================================================================
// Streaming Tests
// ============================================================================

Deno.test({
    name: 'E2E: POST /compile/stream - SSE streaming',
    ignore: !serverAvailable,
    fn: async () => {
        const body = {
            configuration: {
                name: 'SSE Test',
                sources: [{ source: 'sse' }],
            },
            preFetchedContent: {
                sse: '||sse.com^',
            },
        };

        const response = await fetchWithTimeout(`${BASE_URL}/compile/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        assertEquals(response.status, 200);
        assertEquals(response.headers.get('content-type'), 'text/event-stream');
        assertEquals(response.headers.get('cache-control'), 'no-cache');

        // Read stream
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let eventCount = 0;
        let hasResultEvent = false;

        const timeout = setTimeout(() => {
            reader.cancel();
        }, 5000);

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process complete events (split by double newline)
                const events = buffer.split('\n\n');
                // All but the last entry are complete events; keep the last as a potential partial
                const completeEvents = events.slice(0, -1);
                buffer = events[events.length - 1] ?? '';

                for (const event of completeEvents) {
                    if (event.includes('event:')) {
                        eventCount++;
                        if (event.includes('event: result')) {
                            hasResultEvent = true;
                        }
                    }
                }
            }
        } finally {
            clearTimeout(timeout);
        }

        // Verify we received events
        assertEquals(eventCount > 0, true, 'Should receive at least one SSE event');
        assertEquals(hasResultEvent, true, 'Should receive result event');
    },
});

// ============================================================================
// Queue Tests
// ============================================================================

Deno.test({
    name: 'E2E: GET /queue/stats - queue statistics',
    ignore: !serverAvailable,
    fn: async () => {
        const response = await fetchWithTimeout(`${BASE_URL}/queue/stats`);

        // Queue may not be configured (500) or return stats (200)
        if (response.status === 200) {
            const data = (await response.json()) as any;
            assertExists(data);
            // Should have queue metrics if available
        } else if (response.status === 500) {
            // Queue not configured - acceptable in local environment
            console.log('   Queue not configured (expected in local env)');
        } else {
            throw new Error(`Unexpected status: ${response.status}`);
        }
    },
});

Deno.test({
    name: 'E2E: POST /compile/async - async compilation',
    ignore: !serverAvailable,
    fn: async () => {
        const body = {
            configuration: {
                name: 'Async Test',
                sources: [{ source: 'async' }],
            },
            preFetchedContent: {
                async: '||async.com^',
            },
        };

        const response = await fetchWithTimeout(`${BASE_URL}/compile/async`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        // Accept both 202 (queued) and 500 (queue not available)
        if (response.status === 202) {
            const data = (await response.json()) as any;
            assertExists(data.requestId);
            console.log(`   Job queued: ${data.requestId}`);
        } else if (response.status === 500) {
            console.log('   Queue not available (expected in local env)');
        } else {
            throw new Error(`Unexpected status ${response.status}`);
        }
    },
});

Deno.test({
    name: 'E2E: POST /compile/batch/async - async batch compilation',
    ignore: !serverAvailable,
    fn: async () => {
        const body = {
            requests: [{
                id: 'async-batch',
                configuration: { name: 'AB', sources: [{ source: 'ab' }] },
                preFetchedContent: { ab: '||ab.com^' },
            }],
        };

        const response = await fetchWithTimeout(`${BASE_URL}/compile/batch/async`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        // Accept both 202 (queued) and 500 (queue not available)
        if (response.status !== 202 && response.status !== 500) {
            throw new Error(`Unexpected status ${response.status}`);
        }
    },
});

Deno.test({
    name: 'E2E: GET /queue/results/{id} - retrieve queue results',
    ignore: !serverAvailable,
    fn: async () => {
        const response = await fetchWithTimeout(`${BASE_URL}/queue/results/test-id-12345`);

        // 404 is expected for non-existent ID, 200 if result exists
        if (response.status !== 404 && response.status !== 200 && response.status !== 500) {
            throw new Error(`Unexpected status ${response.status}`);
        }
    },
});

// ============================================================================
// Performance Tests
// ============================================================================

Deno.test({
    name: 'E2E: Performance - response time < 2s',
    ignore: !serverAvailable,
    fn: async () => {
        const start = Date.now();
        const response = await fetchWithTimeout(`${BASE_URL}/api`);
        const duration = Date.now() - start;

        assertEquals(response.status, 200);

        if (duration > 2000) {
            throw new Error(`Response time ${duration}ms exceeds 2000ms threshold`);
        }

        console.log(`   Response time: ${duration}ms`);
    },
});

Deno.test({
    name: 'E2E: Performance - concurrent requests',
    ignore: !serverAvailable,
    fn: async () => {
        const promises = Array(5).fill(null).map(() => fetchWithTimeout(`${BASE_URL}/api`));

        const responses = await Promise.all(promises);
        const failures = responses.filter((r) => !r.ok);

        assertEquals(failures.length, 0, `${failures.length}/5 concurrent requests failed`);

        console.log('   5 concurrent requests succeeded');
    },
});

Deno.test({
    name: 'E2E: Performance - large batch compilation',
    ignore: !serverAvailable,
    fn: async () => {
        const requests = Array(10).fill(null).map((_, i) => ({
            id: `large-${i}`,
            configuration: { name: `L${i}`, sources: [{ source: `s${i}` }] },
            preFetchedContent: { [`s${i}`]: '||test.com^' },
        }));

        const response = await fetchWithTimeout(
            `${BASE_URL}/compile/batch`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requests }),
            },
            15000, // Longer timeout for batch
        );

        assertEquals(response.status, 200);

        const data = (await response.json()) as any;
        assertEquals(data.results.length, 10, 'Not all items compiled');

        console.log('   Compiled 10 items successfully');
    },
});

// ============================================================================
// Error Handling Tests
// ============================================================================

Deno.test({
    name: 'E2E: Error handling - invalid JSON',
    ignore: !serverAvailable,
    fn: async () => {
        const response = await fetchWithTimeout(`${BASE_URL}/compile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'invalid json {',
        });

        // Should return 400 for malformed JSON
        assertEquals(response.status, 400);
    },
});

Deno.test({
    name: 'E2E: Error handling - missing configuration',
    ignore: !serverAvailable,
    fn: async () => {
        const response = await fetchWithTimeout(`${BASE_URL}/compile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });

        // Should return error status
        assertEquals(response.status >= 400, true);
    },
});

Deno.test({
    name: 'E2E: CORS headers - preflight request',
    ignore: !serverAvailable,
    fn: async () => {
        const response = await fetchWithTimeout(`${BASE_URL}/compile`, {
            method: 'OPTIONS',
        });

        assertEquals(response.status, 204);
        assertExists(response.headers.get('access-control-allow-origin'));
        assertExists(response.headers.get('access-control-allow-methods'));
    },
});

// ============================================================================
// Additional Endpoint Tests
// ============================================================================

Deno.test({
    name: 'E2E: GET / - returns web UI',
    ignore: !serverAvailable,
    fn: async () => {
        const response = await fetchWithTimeout(`${BASE_URL}/`);

        assertEquals(response.status, 200);
        assertEquals(response.headers.get('content-type')?.includes('text/html'), true);
    },
});

Deno.test({
    name: 'E2E: GET /api/deployments - deployment history',
    ignore: !serverAvailable,
    fn: async () => {
        const response = await fetchWithTimeout(`${BASE_URL}/api/deployments`);

        if (response.status === 200) {
            const data = (await response.json()) as any;
            assertExists(data);
        } else {
            // May return 404 if not implemented
            console.log('   Deployment history not available');
        }
    },
});
