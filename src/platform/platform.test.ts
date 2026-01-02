/**
 * Tests for the platform abstraction layer.
 */

import { describe, it } from 'jsr:@std/testing@^1.0.0/bdd';
import { expect } from 'jsr:@std/expect@^1.0.0';

import { HttpFetcher } from './HttpFetcher.ts';
import { PreFetchedContentFetcher } from './PreFetchedContentFetcher.ts';
import { CompositeFetcher } from './CompositeFetcher.ts';
import { PlatformDownloader } from './PlatformDownloader.ts';
import { WorkerCompiler } from './WorkerCompiler.ts';
import type { IContentFetcher } from './types.ts';
import { TransformationType, type IConfiguration } from '../types/index.ts';

describe('HttpFetcher', () => {
    it('should handle HTTP URLs', () => {
        const fetcher = new HttpFetcher();
        expect(fetcher.canHandle('http://example.com/list.txt')).toBe(true);
        expect(fetcher.canHandle('https://example.com/list.txt')).toBe(true);
    });

    it('should not handle non-HTTP sources', () => {
        const fetcher = new HttpFetcher();
        expect(fetcher.canHandle('file:///path/to/file.txt')).toBe(false);
        expect(fetcher.canHandle('/path/to/file.txt')).toBe(false);
        expect(fetcher.canHandle('my-source-key')).toBe(false);
    });
});

describe('PreFetchedContentFetcher', () => {
    it('should handle pre-fetched content with Map', () => {
        const content = new Map([
            ['source-1', 'rule1\nrule2'],
            ['source-2', 'rule3\nrule4'],
        ]);
        const fetcher = new PreFetchedContentFetcher(content);

        expect(fetcher.canHandle('source-1')).toBe(true);
        expect(fetcher.canHandle('source-2')).toBe(true);
        expect(fetcher.canHandle('source-3')).toBe(false);
    });

    it('should handle pre-fetched content with Record', () => {
        const content = {
            'source-1': 'rule1\nrule2',
            'source-2': 'rule3\nrule4',
        };
        const fetcher = new PreFetchedContentFetcher(content);

        expect(fetcher.canHandle('source-1')).toBe(true);
        expect(fetcher.canHandle('source-2')).toBe(true);
        expect(fetcher.canHandle('source-3')).toBe(false);
    });

    it('should fetch pre-fetched content', async () => {
        const content = new Map([
            ['source-1', 'rule1\nrule2'],
        ]);
        const fetcher = new PreFetchedContentFetcher(content);

        const result = await fetcher.fetch('source-1');
        expect(result).toBe('rule1\nrule2');
    });

    it('should throw for missing content', async () => {
        const fetcher = new PreFetchedContentFetcher(new Map());

        await expect(fetcher.fetch('missing')).rejects.toThrow(
            'No pre-fetched content available for: missing',
        );
    });
});

describe('CompositeFetcher', () => {
    it('should try fetchers in order', async () => {
        const preFetched = new PreFetchedContentFetcher(
            new Map([['local-source', 'local content']]),
        );

        // Mock HTTP fetcher that handles all HTTP URLs
        const mockHttp: IContentFetcher = {
            canHandle: (s) => s.startsWith('http'),
            fetch: () => Promise.resolve('http content'),
        };

        const composite = new CompositeFetcher([preFetched, mockHttp]);

        expect(composite.canHandle('local-source')).toBe(true);
        expect(composite.canHandle('http://example.com')).toBe(true);
        expect(composite.canHandle('unknown')).toBe(false);

        const localResult = await composite.fetch('local-source');
        expect(localResult).toBe('local content');

        const httpResult = await composite.fetch('http://example.com');
        expect(httpResult).toBe('http content');
    });

    it('should throw when no fetcher can handle source', async () => {
        const composite = new CompositeFetcher([]);

        await expect(composite.fetch('unknown')).rejects.toThrow(
            'No fetcher available for source: unknown',
        );
    });
});

describe('PlatformDownloader', () => {
    it('should download from pre-fetched content', async () => {
        const mockFetcher: IContentFetcher = {
            canHandle: () => true,
            fetch: () => Promise.resolve('rule1\nrule2\nrule3'),
        };

        const downloader = new PlatformDownloader(mockFetcher);
        const result = await downloader.download('test-source');

        expect(result).toEqual(['rule1', 'rule2', 'rule3']);
    });

    it('should handle !#include directive', async () => {
        const sources = new Map([
            ['main.txt', '! Main list\nrule1\n!#include included.txt\nrule3'],
            ['included.txt', 'rule2'],
        ]);

        const fetcher = new PreFetchedContentFetcher(sources);
        const downloader = new PlatformDownloader(fetcher);

        const result = await downloader.download('main.txt');
        expect(result).toEqual(['! Main list', 'rule1', 'rule2', 'rule3']);
    });

    it('should handle !#if directive with true condition', async () => {
        const content = `rule1
!#if true
rule2
!#endif
rule3`;

        const fetcher: IContentFetcher = {
            canHandle: () => true,
            fetch: () => Promise.resolve(content),
        };

        const downloader = new PlatformDownloader(fetcher);
        const result = await downloader.download('test');

        expect(result).toEqual(['rule1', 'rule2', 'rule3']);
    });

    it('should handle !#if directive with false condition', async () => {
        const content = `rule1
!#if false
rule2
!#endif
rule3`;

        const fetcher: IContentFetcher = {
            canHandle: () => true,
            fetch: () => Promise.resolve(content),
        };

        const downloader = new PlatformDownloader(fetcher);
        const result = await downloader.download('test');

        expect(result).toEqual(['rule1', 'rule3']);
    });

    it('should handle !#if/!#else directive', async () => {
        const content = `rule1
!#if false
rule2
!#else
rule3
!#endif
rule4`;

        const fetcher: IContentFetcher = {
            canHandle: () => true,
            fetch: () => Promise.resolve(content),
        };

        const downloader = new PlatformDownloader(fetcher);
        const result = await downloader.download('test');

        expect(result).toEqual(['rule1', 'rule3', 'rule4']);
    });

    it('should detect circular includes', async () => {
        const sources = new Map([
            ['a.txt', '!#include b.txt'],
            ['b.txt', '!#include a.txt'],
        ]);

        const fetcher = new PreFetchedContentFetcher(sources);
        const downloader = new PlatformDownloader(fetcher);

        // Should not throw, just skip circular includes
        const result = await downloader.download('a.txt');
        expect(result).toEqual([]);
    });

    it('should respect max include depth', async () => {
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
        expect(result).not.toContain('deep-rule');
    });
});

describe('WorkerCompiler', () => {
    it('should compile with pre-fetched content', async () => {
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
        expect(result.some((line) => line.includes('Title: Test List'))).toBe(true);
        expect(result.some((line) => line.includes('||ads.example.com^'))).toBe(true);
        expect(result.some((line) => line.includes('||tracking.example.com^'))).toBe(true);
    });

    it('should compile with metrics when benchmarking enabled', async () => {
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

        expect(result.rules.length).toBeGreaterThan(0);
        expect(result.metrics).toBeDefined();
        expect(result.metrics?.totalDurationMs).toBeGreaterThanOrEqual(0);
        expect(result.metrics?.sourceCount).toBe(1);
    });

    it('should emit events during compilation', async () => {
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

        expect(events).toContain('source:start');
        expect(events).toContain('source:complete');
        expect(events).toContain('transformation:start');
        expect(events).toContain('transformation:complete');
        expect(events).toContain('compilation:complete');
    });

    it('should throw on invalid configuration', async () => {
        const compiler = new WorkerCompiler();

        // @ts-expect-error - Testing invalid input
        const invalidConfig: IConfiguration = {
            name: 'Test',
            // Missing sources
        };

        await expect(compiler.compile(invalidConfig)).rejects.toThrow(
            'Failed to validate configuration',
        );
    });

    it('should apply source-level transformations', async () => {
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
        expect(result.some((line) => line === 'rule1')).toBe(true);
        expect(result.some((line) => line === 'rule2')).toBe(true);
    });

    it('should use custom fetcher when provided', async () => {
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

        expect(fetchCalled).toBe(true);
    });
});
