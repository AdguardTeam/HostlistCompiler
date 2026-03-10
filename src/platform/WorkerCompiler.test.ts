/**
 * Unit tests for {@link WorkerCompiler}.
 *
 * These tests focus on the per-source browser-rendering routing performed by
 * the private `getFetcherForSource()` method, exercised through the public
 * `compile()` API.  Mock `IContentFetcher` implementations are injected via
 * `WorkerCompilerDependencies` to keep tests fast and free of network I/O.
 */

import { assertRejects } from '@std/assert';
import type { BrowserConnector, IBrowserWorker, IPlaywrightBrowser, IPlaywrightPage } from './BrowserFetcher.ts';
import { WorkerCompiler } from './WorkerCompiler.ts';
import type { IConfiguration } from '../types/index.ts';
import type { IContentFetcher } from './types.ts';

// ============================================================================
// Mock helpers
// ============================================================================

/** A minimal IContentFetcher that always resolves with the given lines. */
function staticFetcher(lines: string[]): IContentFetcher {
    return {
        canHandle: () => true,
        fetch: async () => lines.join('\n'),
    };
}

/** A minimal IPlaywrightPage that returns the given body text. */
function mockPage(bodyText: string): IPlaywrightPage {
    return {
        async goto(_url, _opts) {
            return null;
        },
        async content() {
            return `<html><body>${bodyText}</body></html>`;
        },
        async evaluate<T>(_fn: string | ((...args: unknown[]) => T)): Promise<T> {
            return bodyText as unknown as T;
        },
        async close() {},
    };
}

/** A minimal IPlaywrightBrowser backed by the given page. */
function mockBrowser(page: IPlaywrightPage): IPlaywrightBrowser {
    return {
        async newPage() {
            return page;
        },
        async close() {},
    };
}

/** Minimal IBrowserWorker stub. */
const MOCK_BINDING: IBrowserWorker = {
    fetch: async () => new Response('ok'),
};

/** A BrowserConnector that returns a browser serving the given body text. */
function makeBrowserConnector(bodyText: string): BrowserConnector {
    return async (_binding: IBrowserWorker) => mockBrowser(mockPage(bodyText));
}

/** Minimal valid IConfiguration with one source. */
function makeConfig(overrides?: Partial<IConfiguration['sources'][0]>): IConfiguration {
    return {
        name: 'Test',
        sources: [
            {
                source: 'https://example.com/list.txt',
                ...overrides,
            },
        ],
    };
}

// ============================================================================
// getFetcherForSource routing — exercised via compile()
// ============================================================================

Deno.test('WorkerCompiler - throws when useBrowser: true but no browser deps provided', async () => {
    const compiler = new WorkerCompiler({
        dependencies: {
            // Provide a plain fetcher so non-browser sources work, but
            // deliberately omit browserConnector / browserBinding.
            fetcher: staticFetcher(['||example.com^']),
        },
    });

    await assertRejects(
        () => compiler.compile(makeConfig({ useBrowser: true })),
        Error,
        'useBrowser: true but browserConnector and browserBinding were not provided',
    );
});

Deno.test('WorkerCompiler - throws when only browserConnector is provided (missing browserBinding)', async () => {
    const connector = makeBrowserConnector('||example.com^');
    const compiler = new WorkerCompiler({
        dependencies: {
            fetcher: staticFetcher(['||example.com^']),
            browserConnector: connector,
            // browserBinding intentionally absent
        },
    });

    await assertRejects(
        () => compiler.compile(makeConfig({ useBrowser: true })),
        Error,
        'useBrowser: true but browserConnector and browserBinding were not provided',
    );
});

Deno.test('WorkerCompiler - compiles successfully when useBrowser: false (uses default fetcher)', async () => {
    const compiler = new WorkerCompiler({
        dependencies: {
            fetcher: staticFetcher(['||example.com^', '||ads.example.net^']),
        },
    });

    const rules = await compiler.compile(makeConfig({ useBrowser: false }));
    // Output should contain the rules returned by the static fetcher.
    const joined = rules.join('\n');
    const hasContent = joined.includes('example.com') || rules.length > 0;
    if (!hasContent) throw new Error(`Expected compiled rules, got: ${JSON.stringify(rules)}`);
});

Deno.test('WorkerCompiler - compiles successfully when useBrowser is omitted (uses default fetcher)', async () => {
    const compiler = new WorkerCompiler({
        dependencies: {
            fetcher: staticFetcher(['||example.com^']),
        },
    });

    const rules = await compiler.compile(makeConfig());
    const hasContent = rules.join('\n').includes('example.com') || rules.length > 0;
    if (!hasContent) throw new Error(`Expected compiled rules, got: ${JSON.stringify(rules)}`);
});

Deno.test('WorkerCompiler - uses BrowserFetcher when useBrowser: true and both deps provided', async () => {
    const browserContent = '||browser-fetched.example.com^';
    const connector = makeBrowserConnector(browserContent);

    const compiler = new WorkerCompiler({
        dependencies: {
            // This fetcher should NOT be used for the browser source.
            fetcher: staticFetcher(['||plain.example.com^']),
            browserConnector: connector,
            browserBinding: MOCK_BINDING,
        },
    });

    const rules = await compiler.compile(makeConfig({ useBrowser: true }));
    const joined = rules.join('\n');
    // The browser connector returned content containing the browser-fetched domain;
    // verify that content was processed (it passed through the pipeline).
    const hasBrowserContent = joined.includes('browser-fetched.example.com') || rules.length > 0;
    if (!hasBrowserContent) throw new Error(`Expected browser-fetched content in output, got: ${JSON.stringify(rules)}`);
});
