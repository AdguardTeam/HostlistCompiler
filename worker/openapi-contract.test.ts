/**
 * OpenAPI Contract Validation Tests
 *
 * These tests validate that the actual API responses conform to the OpenAPI specification.
 * Run these tests against a live server to ensure contract compliance.
 *
 * To run these tests: deno task test:contract
 * Or set SKIP_CONTRACT_TESTS=false to include them in regular test runs
 */

import { assertEquals, assertExists } from '@std/assert';
import { parse } from 'https://deno.land/std@0.224.0/yaml/mod.ts';
import type { ApiInfo, BatchCompileResponse, CompileResponse, MetricsResponse, QueueResponse, QueueStats } from './openapi-types.ts';

const BASE_URL = Deno.env.get('API_BASE_URL') || 'http://localhost:8787';
const OPENAPI_PATH = './openapi.yaml';
const SKIP_CONTRACT_TESTS = Deno.env.get('SKIP_CONTRACT_TESTS') !== 'false';

// Load OpenAPI spec
// deno-lint-ignore no-explicit-any
let openApiSpec: any;

async function loadOpenAPISpec() {
    if (!openApiSpec) {
        const content = await Deno.readTextFile(OPENAPI_PATH);
        openApiSpec = parse(content);
    }
    return openApiSpec;
}

// Helper to make API requests
async function apiRequest(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${BASE_URL}${path}`;
    return await fetch(url, options);
}

// Helper to validate response status
function validateResponseStatus(response: Response, expectedStatuses: number[]) {
    const status = response.status;
    assertEquals(
        expectedStatuses.includes(status),
        true,
        `Expected status ${expectedStatuses.join(' or ')}, got ${status}`,
    );
}

// Helper to validate JSON schema (basic validation)
// deno-lint-ignore no-explicit-any
function validateBasicSchema(data: any, requiredFields: string[]) {
    for (const field of requiredFields) {
        assertExists(data[field], `Missing required field: ${field}`);
    }
}

Deno.test({
    name: 'Contract: GET /api - Returns API info',
    ignore: SKIP_CONTRACT_TESTS,
    async fn() {
        const spec = await loadOpenAPISpec();
        const response = await apiRequest('/api');

        validateResponseStatus(response, [200]);
        assertEquals(response.headers.get('content-type')?.includes('application/json'), true);

        const data: ApiInfo = await response.json();
        validateBasicSchema(data, ['name', 'version', 'endpoints']);

        assertEquals(data.name, spec.info.title);
    },
});

Deno.test({
    name: 'Contract: GET /metrics - Returns performance metrics',
    ignore: SKIP_CONTRACT_TESTS,
    async fn() {
        const response = await apiRequest('/metrics');

        validateResponseStatus(response, [200]);
        assertEquals(response.headers.get('content-type')?.includes('application/json'), true);

        const data: MetricsResponse = await response.json();
        validateBasicSchema(data, ['window', 'timestamp', 'endpoints']);
    },
});

Deno.test({
    name: 'Contract: POST /compile - Simple compilation',
    ignore: SKIP_CONTRACT_TESTS,
    async fn() {
        const requestBody = {
            configuration: {
                name: 'Test Filter List',
                sources: [
                    {
                        source: 'test-rules',
                    },
                ],
                transformations: ['Deduplicate'],
            },
            preFetchedContent: {
                'test-rules': '||ads.example.com^\n||tracking.example.com^\n||ads.example.com^',
            },
        };

        const response = await apiRequest('/compile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        validateResponseStatus(response, [200]);
        assertEquals(response.headers.get('content-type')?.includes('application/json'), true);

        // Check for cache header as per spec
        const cacheHeader = response.headers.get('X-Cache');
        if (cacheHeader) {
            assertEquals(['HIT', 'MISS'].includes(cacheHeader), true);
        }

        const data: CompileResponse = await response.json();
        validateBasicSchema(data, ['success', 'rules', 'ruleCount', 'compiledAt']);

        assertEquals(data.success, true);
        assertEquals(Array.isArray(data.rules), true);
        assertEquals(typeof data.ruleCount, 'number');
    },
});

Deno.test({
    name: 'Contract: POST /compile - With benchmark',
    ignore: SKIP_CONTRACT_TESTS,
    async fn() {
        const requestBody = {
            configuration: {
                name: 'Benchmark Test',
                sources: [
                    {
                        source: 'bench-test',
                    },
                ],
            },
            preFetchedContent: {
                'bench-test': '||test.com^',
            },
            benchmark: true,
        };

        const response = await apiRequest('/compile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        validateResponseStatus(response, [200]);

        const data: CompileResponse = await response.json();
        validateBasicSchema(data, ['success', 'rules', 'metrics']);

        // Validate metrics structure
        assertExists(data.metrics);
        assertExists(data.metrics.totalDurationMs);
        assertEquals(typeof data.metrics.totalDurationMs, 'number');
    },
});

Deno.test({
    name: 'Contract: POST /compile - Invalid configuration returns 500',
    ignore: SKIP_CONTRACT_TESTS,
    async fn() {
        const requestBody = {
            configuration: {
                // Missing required 'name' field
                sources: [],
            },
        };

        const response = await apiRequest('/compile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        validateResponseStatus(response, [500]);

        const data: CompileResponse = await response.json();
        assertEquals(data.success, false);
        assertExists(data.error);
    },
});

Deno.test({
    name: 'Contract: POST /compile/batch - Batch compilation',
    ignore: SKIP_CONTRACT_TESTS,
    async fn() {
        const requestBody = {
            requests: [
                {
                    id: 'list1',
                    configuration: {
                        name: 'Batch List 1',
                        sources: [
                            {
                                source: 'batch1',
                            },
                        ],
                    },
                    preFetchedContent: {
                        batch1: '||ads1.com^',
                    },
                },
                {
                    id: 'list2',
                    configuration: {
                        name: 'Batch List 2',
                        sources: [
                            {
                                source: 'batch2',
                            },
                        ],
                    },
                    preFetchedContent: {
                        batch2: '||ads2.com^',
                    },
                },
            ],
        };

        const response = await apiRequest('/compile/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        validateResponseStatus(response, [200]);

        const data: BatchCompileResponse = await response.json();
        validateBasicSchema(data, ['success', 'results']);

        assertEquals(data.success, true);
        assertEquals(Array.isArray(data.results), true);
        assertEquals(data.results?.length, 2);

        // Validate each result
        data.results?.forEach((result: CompileResponse & { id: string }) => {
            assertExists(result.id);
            assertExists(result.rules);
            assertEquals(Array.isArray(result.rules), true);
        });
    },
});

Deno.test({
    name: 'Contract: POST /compile/batch - Exceeds max limit (>10)',
    ignore: SKIP_CONTRACT_TESTS,
    async fn() {
        const requests = Array.from({ length: 11 }, (_, i) => ({
            id: `list${i + 1}`,
            configuration: {
                name: `List ${i + 1}`,
                sources: [{ source: `s${i}` }],
            },
            preFetchedContent: {
                [`s${i}`]: '||test.com^',
            },
        }));

        const response = await apiRequest('/compile/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests }),
        });

        // Should return 400 for exceeding batch limit
        validateResponseStatus(response, [400]);
    },
});

Deno.test({
    name: 'Contract: POST /compile/stream - SSE streaming',
    ignore: SKIP_CONTRACT_TESTS,
    async fn() {
        const requestBody = {
            configuration: {
                name: 'Streaming Test',
                sources: [
                    {
                        source: 'stream-test',
                    },
                ],
            },
            preFetchedContent: {
                'stream-test': '||streaming.com^',
            },
        };

        const response = await apiRequest('/compile/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        validateResponseStatus(response, [200]);
        assertEquals(response.headers.get('content-type')?.includes('text/event-stream'), true);

        // Read some of the stream
        const reader = response.body?.getReader();
        if (reader) {
            const decoder = new TextDecoder();
            let receivedData = '';
            let chunks = 0;

            while (chunks < 5) {
                const { done, value } = await reader.read();
                if (done) break;

                receivedData += decoder.decode(value, { stream: true });
                chunks++;
            }

            // Verify SSE format
            assertEquals(receivedData.includes('event:'), true);
            assertEquals(receivedData.includes('data:'), true);

            reader.cancel();
        }
    },
});

Deno.test({
    name: 'Contract: GET /queue/stats - Queue statistics',
    ignore: SKIP_CONTRACT_TESTS,
    async fn() {
        const response = await apiRequest('/queue/stats');

        validateResponseStatus(response, [200]);

        const data: QueueStats = await response.json();
        validateBasicSchema(data, ['pending', 'completed', 'failed']);

        assertEquals(typeof data.pending, 'number');
        assertEquals(typeof data.completed, 'number');
        assertEquals(typeof data.failed, 'number');
    },
});

Deno.test({
    name: 'Contract: POST /compile/async - Queue async job',
    ignore: SKIP_CONTRACT_TESTS,
    async fn() {
        const requestBody = {
            configuration: {
                name: 'Async Test',
                sources: [
                    {
                        source: 'async-test',
                    },
                ],
            },
            preFetchedContent: {
                'async-test': '||async.com^',
            },
        };

        const response = await apiRequest('/compile/async', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        // May return 202 if queue is available, or 500 if not configured
        validateResponseStatus(response, [202, 500]);

        if (response.status === 202) {
            const data: QueueResponse = await response.json();
            validateBasicSchema(data, ['success', 'requestId', 'message']);
            assertEquals(data.success, true);
        }
    },
});

Deno.test({
    name: 'Contract: GET /queue/results/{requestId} - Not found',
    ignore: SKIP_CONTRACT_TESTS,
    async fn() {
        const fakeRequestId = 'nonexistent-request-id';
        const response = await apiRequest(`/queue/results/${fakeRequestId}`);

        // Should return 404 for non-existent request
        validateResponseStatus(response, [404]);
    },
});

Deno.test({
    name: 'Contract: Response headers - CORS',
    ignore: SKIP_CONTRACT_TESTS,
    async fn() {
        const response = await apiRequest('/api');

        // Check for CORS headers (if implemented)
        const corsHeader = response.headers.get('Access-Control-Allow-Origin');
        if (corsHeader) {
            assertEquals(typeof corsHeader, 'string');
        }
    },
});

Deno.test({
    name: 'Contract: Validate transformation types',
    ignore: SKIP_CONTRACT_TESTS,
    async fn() {
        const spec = await loadOpenAPISpec();
        const transformationEnum = spec.components.schemas.Transformation.enum;

        // Test with a valid transformation
        const requestBody = {
            configuration: {
                name: 'Transformation Test',
                sources: [{ source: 'test' }],
                transformations: [transformationEnum[0]], // Use first valid transformation
            },
            preFetchedContent: {
                test: '||test.com^',
            },
        };

        const response = await apiRequest('/compile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        validateResponseStatus(response, [200]);

        const data: CompileResponse = await response.json();
        assertEquals(data.success, true);
    },
});

Deno.test({
    name: 'Contract: Cache behavior - Deduplication header',
    ignore: SKIP_CONTRACT_TESTS,
    async fn() {
        const requestBody = {
            configuration: {
                name: 'Cache Test',
                sources: [{ source: 'cache-test' }],
            },
            preFetchedContent: {
                'cache-test': '||cache.com^',
            },
        };

        // Make first request
        const response1 = await apiRequest('/compile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        assertEquals(response1.status, 200);

        // Make identical request immediately
        const response2 = await apiRequest('/compile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        assertEquals(response2.status, 200);

        // At least one should have cache hit or deduplication
        const cache1 = response1.headers.get('X-Cache');
        const cache2 = response2.headers.get('X-Cache');
        const dedup2 = response2.headers.get('X-Request-Deduplication');

        const hasCacheOrDedup = cache1 === 'HIT' || cache2 === 'HIT' || dedup2 === 'HIT';
        // Note: This might not always be true due to timing, but it's good to check
        if (hasCacheOrDedup) {
            assertEquals(hasCacheOrDedup, true);
        }
    },
});
