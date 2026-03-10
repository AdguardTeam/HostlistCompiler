/**
 * Unit tests for {@link BrowserFetcher}.
 *
 * Tests use mock {@link BrowserConnector} implementations so they run entirely
 * under Deno without any Cloudflare Workers runtime dependencies.
 *
 * Integration tests that require a live `BROWSER` binding are marked with
 * `ignore: true` and must be run inside a Worker environment (e.g. via
 * `wrangler dev --test-scheduled`).
 */

import { assert, assertEquals, assertRejects } from '@std/assert';
import type { BrowserConnector, IBrowserWorker, IPlaywrightBrowser, IPlaywrightPage } from './BrowserFetcher.ts';
import { BrowserFetcher, EXTRACT_TEXT_SCRIPT } from './BrowserFetcher.ts';

// ============================================================================
// Mock helpers
// ============================================================================

/** Builds a mock IPlaywrightPage that returns the provided body text. */
function mockPage(bodyText: string, outerHtml = '<body>' + bodyText + '</body>'): IPlaywrightPage {
    return {
        async goto(_url, _opts) {
            return null;
        },
        async content() {
            return `<html><body>${bodyText}</body></html>`;
        },
        async evaluate<T>(fn: string | ((...args: unknown[]) => T)): Promise<T> {
            if (typeof fn === 'string') {
                // Simulate EXTRACT_TEXT_SCRIPT returning body text
                if (fn === EXTRACT_TEXT_SCRIPT) {
                    return bodyText as unknown as T;
                }
                // Simulate outerHTML request
                if (fn === 'document.body.outerHTML') {
                    return outerHtml as unknown as T;
                }
            }
            return bodyText as unknown as T;
        },
        async close() {},
    };
}

/** Builds a mock IPlaywrightBrowser backed by the given page. */
function mockBrowser(page: IPlaywrightPage, closeSpy?: () => void): IPlaywrightBrowser {
    return {
        async newPage() {
            return page;
        },
        async close() {
            closeSpy?.();
        },
    };
}

/** A minimal IBrowserWorker stub (the BrowserFetcher delegates to the connector, never calls this directly). */
const MOCK_BINDING: IBrowserWorker = {
    fetch: async () => new Response('ok'),
};

/** Creates a connector that returns the given browser. */
function makeConnector(browser: IPlaywrightBrowser): BrowserConnector {
    return async (_binding: IBrowserWorker) => browser;
}

// ============================================================================
// Tests
// ============================================================================

Deno.test('BrowserFetcher - fetches text content from a page', async () => {
    const page = mockPage('! Filter list content\n||example.com^');
    const fetcher = new BrowserFetcher(MOCK_BINDING, {}, makeConnector(mockBrowser(page)));

    const result = await fetcher.fetch('https://example.com/filters.txt');

    assertEquals(result, '! Filter list content\n||example.com^');
});

Deno.test('BrowserFetcher - returns HTML when returnHtml is true', async () => {
    const page = mockPage('text content', '<body>html content</body>');
    const fetcher = new BrowserFetcher(MOCK_BINDING, { returnHtml: true }, makeConnector(mockBrowser(page)));

    const result = await fetcher.fetch('https://example.com/page');

    assertEquals(result, '<body>html content</body>');
});

Deno.test('BrowserFetcher - closes page before closing browser', async () => {
    const events: string[] = [];
    const page: IPlaywrightPage = {
        ...mockPage('content'),
        async close() {
            events.push('page.close');
        },
    };
    const browser = mockBrowser(page, () => events.push('browser.close'));
    const fetcher = new BrowserFetcher(MOCK_BINDING, {}, makeConnector(browser));

    await fetcher.fetch('https://example.com/');

    assertEquals(events, ['page.close', 'browser.close']);
});

Deno.test('BrowserFetcher - passes timeout and waitUntil to page.goto', async () => {
    const gotoArgs: Array<{ url: string; opts: unknown }> = [];
    const page: IPlaywrightPage = {
        ...mockPage('content'),
        async goto(url, opts) {
            gotoArgs.push({ url, opts });
            return null;
        },
    };
    const fetcher = new BrowserFetcher(MOCK_BINDING, { timeout: 10_000, waitUntil: 'load' }, makeConnector(mockBrowser(page)));

    await fetcher.fetch('https://example.com/');

    assertEquals(gotoArgs.length, 1);
    assertEquals(gotoArgs[0].url, 'https://example.com/');
    assertEquals((gotoArgs[0].opts as { timeout: number; waitUntil: string }).timeout, 10_000);
    assertEquals((gotoArgs[0].opts as { timeout: number; waitUntil: string }).waitUntil, 'load');
});

Deno.test('BrowserFetcher - uses default timeout of 30 000 ms', async () => {
    const gotoArgs: Array<{ url: string; opts: unknown }> = [];
    const page: IPlaywrightPage = {
        ...mockPage('content'),
        async goto(url, opts) {
            gotoArgs.push({ url, opts });
            return null;
        },
    };
    const fetcher = new BrowserFetcher(MOCK_BINDING, {}, makeConnector(mockBrowser(page)));

    await fetcher.fetch('https://example.com/');

    assertEquals((gotoArgs[0].opts as { timeout: number }).timeout, 30_000);
});

Deno.test('BrowserFetcher - wraps navigation errors with context', async () => {
    const failingPage: IPlaywrightPage = {
        ...mockPage(''),
        async goto() {
            throw new Error('net::ERR_CONNECTION_REFUSED');
        },
    };
    const fetcher = new BrowserFetcher(MOCK_BINDING, {}, makeConnector(mockBrowser(failingPage)));

    await assertRejects(
        () => fetcher.fetch('https://unreachable.invalid/'),
        Error,
        'BrowserFetcher failed to fetch',
    );
});

Deno.test('BrowserFetcher - still closes browser even when navigation throws', async () => {
    let browserClosed = false;
    const failingPage: IPlaywrightPage = {
        ...mockPage(''),
        async goto() {
            throw new Error('timeout');
        },
    };
    const browser = mockBrowser(failingPage, () => {
        browserClosed = true;
    });
    const fetcher = new BrowserFetcher(MOCK_BINDING, {}, makeConnector(browser));

    await assertRejects(() => fetcher.fetch('https://example.com/'), Error);

    assert(browserClosed, 'browser.close() must be called even after an error');
});

Deno.test('BrowserFetcher - EXTRACT_TEXT_SCRIPT is a non-empty string', () => {
    assert(typeof EXTRACT_TEXT_SCRIPT === 'string');
    assert(EXTRACT_TEXT_SCRIPT.length > 0);
});

Deno.test('BrowserFetcher - empty content is returned as-is (no artificial padding)', async () => {
    const page = mockPage('');
    const fetcher = new BrowserFetcher(MOCK_BINDING, {}, makeConnector(mockBrowser(page)));

    const result = await fetcher.fetch('https://example.com/empty');

    assertEquals(result, '');
});

Deno.test('BrowserFetcher - connector receives the binding', async () => {
    let receivedBinding: IBrowserWorker | undefined;
    const page = mockPage('ok');
    const connector: BrowserConnector = async (b) => {
        receivedBinding = b;
        return mockBrowser(page);
    };
    const fetcher = new BrowserFetcher(MOCK_BINDING, {}, connector);

    await fetcher.fetch('https://example.com/');

    assert(receivedBinding === MOCK_BINDING, 'connector must receive the binding passed to constructor');
});

// ============================================================================
// Integration tests (ignored in Deno — require a live Workers runtime)
// ============================================================================

Deno.test({
    name: 'BrowserFetcher [integration] - fetches a real URL via BROWSER binding',
    ignore: true,
    fn: async () => {
        // Requires: const { launch } = await import('@cloudflare/playwright');
        // const fetcher = new BrowserFetcher(env.BROWSER, {}, launch);
        // const content = await fetcher.fetch('https://filters.adtidy.org/android/filters/2.txt');
        // assert(content.length > 0);
    },
});

Deno.test({
    name: 'BrowserFetcher [integration] - follows JS redirects',
    ignore: true,
    fn: async () => {
        // Verify that a page that redirects via window.location is followed
    },
});

Deno.test({
    name: 'BrowserFetcher [integration] - returnHtml returns full body markup',
    ignore: true,
    fn: async () => {
        // Verify outerHTML is returned when returnHtml: true
    },
});

Deno.test({
    name: 'BrowserFetcher [integration] - timeout option raises TimeoutError',
    ignore: true,
    fn: async () => {
        // Verify a very short timeout (e.g. 1 ms) causes a wrapped timeout error
    },
});
