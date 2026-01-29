/**
 * Tests for CompositeFetcher
 */

import { assertEquals, assertRejects } from '@std/assert';
import { CompositeFetcher } from './CompositeFetcher.ts';
import { PreFetchedContentFetcher } from './PreFetchedContentFetcher.ts';
import type { IContentFetcher } from './types.ts';

/**
 * Mock content fetcher for testing
 */
class MockFetcher implements IContentFetcher {
    private readonly prefix: string;
    private readonly content: string;

    constructor(prefix: string, content = 'mock content') {
        this.prefix = prefix;
        this.content = content;
    }

    canHandle(source: string): boolean {
        return source.startsWith(this.prefix);
    }

    async fetch(source: string): Promise<string> {
        if (!this.canHandle(source)) {
            throw new Error(`Cannot handle source: ${source}`);
        }
        return this.content;
    }
}

Deno.test('CompositeFetcher - constructor', () => {
    const fetcher1 = new MockFetcher('http://');
    const fetcher2 = new MockFetcher('https://');
    const composite = new CompositeFetcher([fetcher1, fetcher2]);

    assertEquals(composite instanceof CompositeFetcher, true);
});

Deno.test('CompositeFetcher - canHandle', async (t) => {
    await t.step('should return true when any fetcher can handle source', () => {
        const fetcher1 = new MockFetcher('http://');
        const fetcher2 = new MockFetcher('https://');
        const composite = new CompositeFetcher([fetcher1, fetcher2]);

        assertEquals(composite.canHandle('http://example.com'), true);
        assertEquals(composite.canHandle('https://example.com'), true);
    });

    await t.step('should return false when no fetcher can handle source', () => {
        const fetcher1 = new MockFetcher('http://');
        const fetcher2 = new MockFetcher('https://');
        const composite = new CompositeFetcher([fetcher1, fetcher2]);

        assertEquals(composite.canHandle('file:///path/to/file'), false);
    });

    await t.step('should return false with empty fetchers array', () => {
        const composite = new CompositeFetcher([]);

        assertEquals(composite.canHandle('http://example.com'), false);
    });
});

Deno.test('CompositeFetcher - fetch', async (t) => {
    await t.step('should fetch using first matching fetcher', async () => {
        const fetcher1 = new MockFetcher('http://', 'content from http');
        const fetcher2 = new MockFetcher('https://', 'content from https');
        const composite = new CompositeFetcher([fetcher1, fetcher2]);

        const result = await composite.fetch('http://example.com');

        assertEquals(result, 'content from http');
    });

    await t.step('should try fetchers in order', async () => {
        const fetcher1 = new MockFetcher('https://', 'from fetcher1');
        const fetcher2 = new MockFetcher('https://', 'from fetcher2');
        const composite = new CompositeFetcher([fetcher1, fetcher2]);

        const result = await composite.fetch('https://example.com');

        // Should use first fetcher that can handle it
        assertEquals(result, 'from fetcher1');
    });

    await t.step('should use second fetcher when first cannot handle', async () => {
        const fetcher1 = new MockFetcher('http://', 'from http');
        const fetcher2 = new MockFetcher('https://', 'from https');
        const composite = new CompositeFetcher([fetcher1, fetcher2]);

        const result = await composite.fetch('https://example.com');

        assertEquals(result, 'from https');
    });

    await t.step('should throw error when no fetcher can handle source', async () => {
        const fetcher1 = new MockFetcher('http://');
        const fetcher2 = new MockFetcher('https://');
        const composite = new CompositeFetcher([fetcher1, fetcher2]);

        await assertRejects(
            () => composite.fetch('file:///path/to/file'),
            Error,
            'No fetcher available for source',
        );
    });

    await t.step('should throw error with empty fetchers array', async () => {
        const composite = new CompositeFetcher([]);

        await assertRejects(
            () => composite.fetch('http://example.com'),
            Error,
            'No fetcher available for source',
        );
    });
});

Deno.test('CompositeFetcher - addFetcher', async (t) => {
    await t.step('should add fetcher to end of chain by default', async () => {
        const fetcher1 = new MockFetcher('https://', 'from fetcher1');
        const composite = new CompositeFetcher([fetcher1]);

        const fetcher2 = new MockFetcher('https://', 'from fetcher2');
        composite.addFetcher(fetcher2);

        // First fetcher should still be used
        const result = await composite.fetch('https://example.com');
        assertEquals(result, 'from fetcher1');
    });

    await t.step('should add fetcher to end when priority is false', async () => {
        const fetcher1 = new MockFetcher('https://', 'from fetcher1');
        const composite = new CompositeFetcher([fetcher1]);

        const fetcher2 = new MockFetcher('https://', 'from fetcher2');
        composite.addFetcher(fetcher2, false);

        // First fetcher should still be used
        const result = await composite.fetch('https://example.com');
        assertEquals(result, 'from fetcher1');
    });

    await t.step('should add fetcher to front when priority is true', async () => {
        const fetcher1 = new MockFetcher('https://', 'from fetcher1');
        const composite = new CompositeFetcher([fetcher1]);

        const fetcher2 = new MockFetcher('https://', 'from fetcher2');
        composite.addFetcher(fetcher2, true);

        // Second fetcher should be used (it was added to front)
        const result = await composite.fetch('https://example.com');
        assertEquals(result, 'from fetcher2');
    });

    await t.step('should enable handling of new source types', () => {
        const fetcher1 = new MockFetcher('http://');
        const composite = new CompositeFetcher([fetcher1]);

        assertEquals(composite.canHandle('https://example.com'), false);

        const fetcher2 = new MockFetcher('https://');
        composite.addFetcher(fetcher2);

        assertEquals(composite.canHandle('https://example.com'), true);
    });

    await t.step('should work with empty initial fetchers', async () => {
        const composite = new CompositeFetcher([]);

        assertEquals(composite.canHandle('http://example.com'), false);

        const fetcher = new MockFetcher('http://', 'content');
        composite.addFetcher(fetcher);

        assertEquals(composite.canHandle('http://example.com'), true);
        const result = await composite.fetch('http://example.com');
        assertEquals(result, 'content');
    });
});

Deno.test('CompositeFetcher - integration with PreFetchedContentFetcher', async (t) => {
    await t.step('should work with PreFetchedContentFetcher', async () => {
        const preFetched = new PreFetchedContentFetcher({
            'source1': 'content1',
            'source2': 'content2',
        });
        const httpFetcher = new MockFetcher('http://', 'http content');
        const composite = new CompositeFetcher([preFetched, httpFetcher]);

        // Should use pre-fetched content
        const result1 = await composite.fetch('source1');
        assertEquals(result1, 'content1');

        // Should use http fetcher
        const result2 = await composite.fetch('http://example.com');
        assertEquals(result2, 'http content');
    });

    await t.step('should prioritize based on order', async () => {
        const preFetched = new PreFetchedContentFetcher({
            'http://example.com': 'pre-fetched content',
        });
        const httpFetcher = new MockFetcher('http://', 'http content');

        // Pre-fetched first
        const composite1 = new CompositeFetcher([preFetched, httpFetcher]);
        const result1 = await composite1.fetch('http://example.com');
        assertEquals(result1, 'pre-fetched content');

        // HTTP fetcher first
        const composite2 = new CompositeFetcher([httpFetcher, preFetched]);
        const result2 = await composite2.fetch('http://example.com');
        assertEquals(result2, 'http content');
    });
});
