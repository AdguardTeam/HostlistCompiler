import { assertEquals, assertRejects } from '@std/assert';
import { HttpFetcher } from './HttpFetcher.ts';

// Unit tests (no network access required)

Deno.test('HttpFetcher - canHandle should return true for http URLs', () => {
    const fetcher = new HttpFetcher();
    assertEquals(fetcher.canHandle('http://example.com'), true);
});

Deno.test('HttpFetcher - canHandle should return true for https URLs', () => {
    const fetcher = new HttpFetcher();
    assertEquals(fetcher.canHandle('https://example.com'), true);
});

Deno.test('HttpFetcher - canHandle should return false for file paths', () => {
    const fetcher = new HttpFetcher();
    assertEquals(fetcher.canHandle('/path/to/file.txt'), false);
    assertEquals(fetcher.canHandle('./relative/path.txt'), false);
    assertEquals(fetcher.canHandle('file.txt'), false);
});

Deno.test('HttpFetcher - canHandle should return false for file URLs', () => {
    const fetcher = new HttpFetcher();
    assertEquals(fetcher.canHandle('file:///path/to/file.txt'), false);
});

Deno.test('HttpFetcher - should use default options', () => {
    const fetcher = new HttpFetcher();
    // Verify it was created without error
    assertEquals(fetcher.canHandle('https://example.com'), true);
});

Deno.test('HttpFetcher - should accept custom options', () => {
    const fetcher = new HttpFetcher({
        timeout: 5000,
        userAgent: 'CustomAgent/1.0',
        allowEmptyResponse: true,
        headers: {
            'Authorization': 'Bearer token',
        },
    });
    // Verify it was created without error
    assertEquals(fetcher.canHandle('https://example.com'), true);
});

// Integration tests (require network access - marked as ignore for CI)
// Run these with: deno test --allow-net src/platform/HttpFetcher.test.ts

Deno.test({
    name: 'HttpFetcher - should fetch content from a URL',
    ignore: true, // Requires network access
    async fn() {
        const fetcher = new HttpFetcher({ timeout: 10000 });

        // Use a well-known filter list that should be accessible
        const content = await fetcher.fetch('https://easylist.to/easylist/easylist.txt');

        // Verify we got some content
        assertEquals(content.length > 0, true);
        // EasyList should contain typical filter syntax
        assertEquals(content.includes('||'), true);
    },
});

Deno.test({
    name: 'HttpFetcher - should throw on HTTP error',
    ignore: true, // Requires network access
    async fn() {
        const fetcher = new HttpFetcher({ timeout: 5000 });

        await assertRejects(
            async () => await fetcher.fetch('https://httpstat.us/404'),
            Error,
            'HTTP 404',
        );
    },
});

Deno.test({
    name: 'HttpFetcher - should throw on empty response when not allowed',
    ignore: true, // Requires network access
    async fn() {
        const fetcher = new HttpFetcher({
            timeout: 5000,
            allowEmptyResponse: false,
        });

        await assertRejects(
            async () => await fetcher.fetch('https://httpstat.us/204'),
            Error,
        );
    },
});

Deno.test({
    name: 'HttpFetcher - should allow empty response when configured',
    ignore: true, // Requires network access
    async fn() {
        const fetcher = new HttpFetcher({
            timeout: 5000,
            allowEmptyResponse: true,
        });

        const content = await fetcher.fetch('https://httpstat.us/204');
        assertEquals(content, '');
    },
});

Deno.test({
    name: 'HttpFetcher - should throw on timeout',
    ignore: true, // Requires network access
    async fn() {
        const fetcher = new HttpFetcher({
            timeout: 1, // 1ms timeout - should fail
        });

        await assertRejects(
            async () => await fetcher.fetch('https://httpstat.us/200?sleep=5000'),
            Error,
        );
    },
});

Deno.test({
    name: 'HttpFetcher - should throw on network error',
    ignore: true, // Requires network access
    async fn() {
        const fetcher = new HttpFetcher({ timeout: 5000 });

        await assertRejects(
            async () => await fetcher.fetch('https://nonexistent.invalid'),
            Error,
        );
    },
});
