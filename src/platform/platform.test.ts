/**
 * Tests for the platform abstraction layer.
 */

import { assert, assertEquals, assertRejects } from '@std/assert';

import { HttpFetcher } from './HttpFetcher.ts';
import { PreFetchedContentFetcher } from './PreFetchedContentFetcher.ts';
import { CompositeFetcher } from './CompositeFetcher.ts';
import { PlatformDownloader } from './PlatformDownloader.ts';
import { WorkerCompiler } from './WorkerCompiler.ts';
import type { IContentFetcher } from './types.ts';
import { type IConfiguration, TransformationType } from '../types/index.ts';

// HttpFetcher Tests
Deno.test('HttpFetcher - should handle HTTP URLs', () => {
    const fetcher = new HttpFetcher();
    assertEquals(fetcher.canHandle('http://example.com/list.txt'), true);
    assertEquals(fetcher.canHandle('https://example.com/list.txt'), true);
});

Deno.test('HttpFetcher - should not handle non-HTTP sources', () => {
    const fetcher = new HttpFetcher();
    assertEquals(fetcher.canHandle('file:///path/to/file.txt'), false);
    assertEquals(fetcher.canHandle('/path/to/file.txt'), false);
    assertEquals(fetcher.canHandle('my-source-key'), false);
});

// PreFetchedContentFetcher Tests
Deno.test('PreFetchedContentFetcher - should handle pre-fetched content with Map', () => {
    const content = new Map([
        ['source-1', 'rule1\nrule2'],
        ['source-2', 'rule3\nrule4'],
    ]);
    const fetcher = new PreFetchedContentFetcher(content);

    assertEquals(fetcher.canHandle('source-1'), true);
    assertEquals(fetcher.canHandle('source-2'), true);
    assertEquals(fetcher.canHandle('source-3'), false);
});

Deno.test('PreFetchedContentFetcher - should handle pre-fetched content with Record', () => {
    const content = {
        'source-1': 'rule1\nrule2',
        'source-2': 'rule3\nrule4',
    };
    const fetcher = new PreFetchedContentFetcher(content);

    assertEquals(fetcher.canHandle('source-1'), true);
    assertEquals(fetcher.canHandle('source-2'), true);
    assertEquals(fetcher.canHandle('source-3'), false);
});

Deno.test('PreFetchedContentFetcher - should fetch pre-fetched content', async () => {
    const content = new Map([
        ['source-1', 'rule1\nrule2'],
    ]);
    const fetcher = new PreFetchedContentFetcher(content);

    const result = await fetcher.fetch('source-1');
    assertEquals(result, 'rule1\nrule2');
});

Deno.test('PreFetchedContentFetcher - should throw for missing content', async () => {
    const fetcher = new PreFetchedContentFetcher(new Map());

    await assertRejects(
        () => fetcher.fetch('missing'),
        Error,
        'No pre-fetched content available for: missing',
    );
});

// CompositeFetcher Tests
Deno.test('CompositeFetcher - should try fetchers in order', async () => {
    const preFetched = new PreFetchedContentFetcher(
        new Map([['local-source', 'local content']]),
    );

    // Mock HTTP fetcher that handles all HTTP URLs
    const mockHttp: IContentFetcher = {
        canHandle: (s) => s.startsWith('http'),
        fetch: async () => 'http content',
    };

    const composite = new CompositeFetcher([preFetched, mockHttp]);

    assertEquals(composite.canHandle('local-source'), true);
    assertEquals(composite.canHandle('http://example.com'), true);
    assertEquals(composite.canHandle('unknown'), false);

    const localResult = await composite.fetch('local-source');
    assertEquals(localResult, 'local content');

    const httpResult = await composite.fetch('http://example.com');
    assertEquals(httpResult, 'http content');
});

Deno.test('CompositeFetcher - should throw when no fetcher can handle source', async () => {
    const composite = new CompositeFetcher([]);

    await assertRejects(
        () => composite.fetch('unknown'),
        Error,
        'No fetcher available for source: unknown',
    );
});

// PlatformDownloader Tests
Deno.test('PlatformDownloader - should download from pre-fetched content', async () => {
    const mockFetcher: IContentFetcher = {
        canHandle: () => true,
        fetch: async () => 'rule1\nrule2\nrule3',
    };

    const downloader = new PlatformDownloader(mockFetcher);
    const result = await downloader.download('test-source');

    assertEquals(result, ['rule1', 'rule2', 'rule3']);
});

Deno.test('PlatformDownloader - should handle !#include directive', async () => {
    const sources = new Map([
        ['main.txt', '! Main list\nrule1\n!#include included.txt\nrule3'],
        ['included.txt', 'rule2'],
    ]);

    const fetcher = new PreFetchedContentFetcher(sources);
    const downloader = new PlatformDownloader(fetcher);

    const result = await downloader.download('main.txt');
    assertEquals(result, ['! Main list', 'rule1', 'rule2', 'rule3']);
});

Deno.test('PlatformDownloader - should handle !#if directive with true condition', async () => {
    const content = `rule1
!#if true
rule2
!#endif
rule3`;

    const fetcher: IContentFetcher = {
        canHandle: () => true,
        fetch: async () => content,
    };

    const downloader = new PlatformDownloader(fetcher);
    const result = await downloader.download('test');

    assertEquals(result, ['rule1', 'rule2', 'rule3']);
});

Deno.test('PlatformDownloader - should handle !#if directive with false condition', async () => {
    const content = `rule1
!#if false
rule2
!#endif
rule3`;

    const fetcher: IContentFetcher = {
        canHandle: () => true,
        fetch: async () => content,
    };

    const downloader = new PlatformDownloader(fetcher);
    const result = await downloader.download('test');

    assertEquals(result, ['rule1', 'rule3']);
});

Deno.test('PlatformDownloader - should handle !#if/!#else directive', async () => {
    const content = `rule1
!#if false
rule2
!#else
rule3
!#endif
rule4`;

    const fetcher: IContentFetcher = {
        canHandle: () => true,
        fetch: async () => content,
    };

    const downloader = new PlatformDownloader(fetcher);
    const result = await downloader.download('test');

    assertEquals(result, ['rule1', 'rule3', 'rule4']);
});

Deno.test('PlatformDownloader - should detect circular includes', async () => {
    const sources = new Map([
        ['a.txt', '!#include b.txt'],
        ['b.txt', '!#include a.txt'],
    ]);

    const fetcher = new PreFetchedContentFetcher(sources);
    const downloader = new PlatformDownloader(fetcher);

    // Should not throw, just skip circular includes
    const result = await downloader.download('a.txt');
    assertEquals(result, []);
});

Deno.test('PlatformDownloader - should respect max include depth', async () => {
    const sources = new Map([
        ['1.txt', '!#include 2.txt'],
        ['2.txt', '!#include 3.txt'],
        ['3.txt', '!#include 4.txt'],
        ['4.txt', 'deep-rule'],
    ]);

    const fetcher = new PreFetchedContentFetcher(sources);
    const downloader = new PlatformDownloader(fetcher, { maxIncludeDepth: 2 });

    // Should stop before reaching 4.txt
    const result = await downloader.download('1.txt');
    assertEquals(result.includes('deep-rule'), false);
});

// WorkerCompiler Tests
Deno.test('WorkerCompiler - should compile with pre-fetched content', async () => {
    const preFetchedContent = new Map([
        ['source-1', '||ads.example.com^\n||tracking.example.com^'],
    ]);

    const configuration: IConfiguration = {
        name: 'Test List',
        sources: [
            { name: 'Test Source', source: 'source-1' },
        ],
        transformations: [TransformationType.RemoveEmptyLines],
    };

    const compiler = new WorkerCompiler({ preFetchedContent });
    const result = await compiler.compile(configuration);

    // Should contain header lines and rules
    assert(result.some((line) => line.includes('Title: Test List')));
    assert(result.some((line) => line.includes('||ads.example.com^')));
    assert(result.some((line) => line.includes('||tracking.example.com^')));
});

Deno.test('WorkerCompiler - should compile with metrics when benchmarking enabled', async () => {
    const preFetchedContent = new Map([
        ['source-1', 'rule1\nrule2\nrule3'],
    ]);

    const configuration: IConfiguration = {
        name: 'Test List',
        sources: [
            { source: 'source-1' },
        ],
    };

    const compiler = new WorkerCompiler({ preFetchedContent });
    const result = await compiler.compileWithMetrics(configuration, true);

    assert(result.rules.length > 0);
    assert(result.metrics !== undefined);
    assert(result.metrics?.totalDurationMs !== undefined && result.metrics.totalDurationMs >= 0);
    assertEquals(result.metrics?.sourceCount, 1);
});

Deno.test('WorkerCompiler - should emit events during compilation', async () => {
    const preFetchedContent = new Map([
        ['source-1', 'rule1\nrule2'],
    ]);

    const events: string[] = [];

    const configuration: IConfiguration = {
        name: 'Test List',
        sources: [
            { source: 'source-1' },
        ],
        transformations: [TransformationType.RemoveEmptyLines],
    };

    const compiler = new WorkerCompiler({
        preFetchedContent,
        events: {
            onSourceStart: () => events.push('source:start'),
            onSourceComplete: () => events.push('source:complete'),
            onTransformationStart: () => events.push('transformation:start'),
            onTransformationComplete: () => events.push('transformation:complete'),
            onProgress: () => events.push('progress'),
            onCompilationComplete: () => events.push('compilation:complete'),
        },
    });

    await compiler.compile(configuration);

    assert(events.includes('source:start'));
    assert(events.includes('source:complete'));
    assert(events.includes('transformation:start'));
    assert(events.includes('transformation:complete'));
    assert(events.includes('compilation:complete'));
});

Deno.test('WorkerCompiler - should throw on invalid configuration', async () => {
    const compiler = new WorkerCompiler();

    // @ts-expect-error - Testing invalid input
    const invalidConfig: IConfiguration = {
        name: 'Test',
        // Missing sources
    };

    await assertRejects(
        () => compiler.compile(invalidConfig),
        Error,
        'Failed to validate configuration',
    );
});

Deno.test('WorkerCompiler - should apply source-level transformations', async () => {
    const preFetchedContent = new Map([
        ['source-1', '  rule1  \n\n  rule2  \n'],
    ]);

    const configuration: IConfiguration = {
        name: 'Test List',
        sources: [
            {
                source: 'source-1',
                transformations: [TransformationType.TrimLines, TransformationType.RemoveEmptyLines],
            },
        ],
    };

    const compiler = new WorkerCompiler({ preFetchedContent });
    const result = await compiler.compile(configuration);

    // Rules should be trimmed
    assert(result.some((line) => line === 'rule1'));
    assert(result.some((line) => line === 'rule2'));
});

Deno.test('WorkerCompiler - should use custom fetcher when provided', async () => {
    let fetchCalled = false;

    const customFetcher: IContentFetcher = {
        canHandle: () => true,
        fetch: async () => {
            fetchCalled = true;
            return 'custom-rule';
        },
    };

    const configuration: IConfiguration = {
        name: 'Test List',
        sources: [{ source: 'any-source' }],
    };

    const compiler = new WorkerCompiler({ customFetcher });
    await compiler.compile(configuration);

    assertEquals(fetchCalled, true);
});
