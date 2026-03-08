/**
 * Unit tests for the container HTTP server handler.
 *
 * The `handler` function is imported directly from `container-server.ts`
 * without starting a live HTTP server (the `Deno.serve()` startup is guarded
 * by `import.meta.main`).
 *
 * Tests cover all handler branches:
 *  - GET /health — 200 JSON with status and version
 *  - POST /compile — success path with pre-fetched content
 *  - POST /compile — invalid JSON body → 400
 *  - POST /compile — missing `configuration` field → 400
 *  - POST /compile — compilation error → 500
 *  - Any other route — 404
 */

import { assertEquals, assertStringIncludes } from '@std/assert';
import { handler } from './container-server.ts';
import { VERSION } from '../src/version.ts';

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------

Deno.test('container-server handler - GET /health returns 200 with status ok and version', async () => {
    const request = new Request('http://localhost:8787/health');
    const response = await handler(request);

    assertEquals(response.status, 200);
    const body = await response.json() as Record<string, unknown>;
    assertEquals(body.status, 'ok');
    assertEquals(body.version, VERSION);
});

// ---------------------------------------------------------------------------
// POST /compile — success
// ---------------------------------------------------------------------------

Deno.test('container-server handler - POST /compile returns compiled rules as plain text', async () => {
    const rule = '||example.com^';
    const request = new Request('http://localhost:8787/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            configuration: {
                name: 'Test',
                sources: [{ source: 'https://example.com/filters.txt' }],
            },
            preFetchedContent: {
                'https://example.com/filters.txt': rule,
            },
        }),
    });

    const response = await handler(request);
    assertEquals(response.status, 200);
    assertEquals(response.headers.get('Content-Type'), 'text/plain; charset=utf-8');
    const text = await response.text();
    assertStringIncludes(text, rule);
});

// ---------------------------------------------------------------------------
// POST /compile — invalid JSON
// ---------------------------------------------------------------------------

Deno.test('container-server handler - POST /compile with invalid JSON returns 400', async () => {
    const request = new Request('http://localhost:8787/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
    });

    const response = await handler(request);
    assertEquals(response.status, 400);
    assertStringIncludes(await response.text(), 'Invalid JSON body');
});

// ---------------------------------------------------------------------------
// POST /compile — missing configuration
// ---------------------------------------------------------------------------

Deno.test('container-server handler - POST /compile with missing configuration returns 400', async () => {
    const request = new Request('http://localhost:8787/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preFetchedContent: {} }),
    });

    const response = await handler(request);
    assertEquals(response.status, 400);
    assertStringIncludes(await response.text(), 'Missing required field: configuration');
});

// ---------------------------------------------------------------------------
// POST /compile — compilation error
// ---------------------------------------------------------------------------

Deno.test('container-server handler - POST /compile returns 500 when compilation throws', async () => {
    // A configuration with no sources and no pre-fetched content produces an
    // empty rule set without throwing.  To trigger a 500 we pass a source URL
    // that is not covered by preFetchedContent and will fail to resolve, which
    // causes WorkerCompiler to throw when the HTTP fetch errors out.
    // We use a deliberately un-parseable URL scheme to force an immediate error.
    const request = new Request('http://localhost:8787/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            configuration: {
                name: 'Error Test',
                sources: [{ source: 'invalid://not-a-real-url' }],
            },
        }),
    });

    const response = await handler(request);
    assertEquals(response.status, 500);
    assertStringIncludes(await response.text(), 'Compilation failed');
});

// ---------------------------------------------------------------------------
// Unknown routes
// ---------------------------------------------------------------------------

Deno.test('container-server handler - GET /unknown returns 404', async () => {
    const request = new Request('http://localhost:8787/unknown');
    const response = await handler(request);
    assertEquals(response.status, 404);
});

Deno.test('container-server handler - POST /health returns 404', async () => {
    const request = new Request('http://localhost:8787/health', { method: 'POST' });
    const response = await handler(request);
    assertEquals(response.status, 404);
});

Deno.test('container-server handler - GET /compile returns 404', async () => {
    const request = new Request('http://localhost:8787/compile');
    const response = await handler(request);
    assertEquals(response.status, 404);
});
