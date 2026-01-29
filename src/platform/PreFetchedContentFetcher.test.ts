/**
 * Tests for PreFetchedContentFetcher
 */

import { assertEquals, assertRejects } from '@std/assert';
import { PreFetchedContentFetcher } from './PreFetchedContentFetcher.ts';

Deno.test('PreFetchedContentFetcher - constructor', async (t) => {
    await t.step('should create instance with Map', () => {
        const content = new Map([
            ['source1', 'content1'],
            ['source2', 'content2'],
        ]);
        const fetcher = new PreFetchedContentFetcher(content);

        assertEquals(fetcher instanceof PreFetchedContentFetcher, true);
    });

    await t.step('should create instance with object', () => {
        const content = {
            'source1': 'content1',
            'source2': 'content2',
        };
        const fetcher = new PreFetchedContentFetcher(content);

        assertEquals(fetcher instanceof PreFetchedContentFetcher, true);
    });

    await t.step('should create instance with empty Map', () => {
        const content = new Map();
        const fetcher = new PreFetchedContentFetcher(content);

        assertEquals(fetcher instanceof PreFetchedContentFetcher, true);
    });

    await t.step('should create instance with empty object', () => {
        const content = {};
        const fetcher = new PreFetchedContentFetcher(content);

        assertEquals(fetcher instanceof PreFetchedContentFetcher, true);
    });
});

Deno.test('PreFetchedContentFetcher - canHandle', async (t) => {
    await t.step('should return true for existing content', () => {
        const fetcher = new PreFetchedContentFetcher({
            'source1': 'content1',
            'source2': 'content2',
        });

        assertEquals(fetcher.canHandle('source1'), true);
        assertEquals(fetcher.canHandle('source2'), true);
    });

    await t.step('should return false for missing content', () => {
        const fetcher = new PreFetchedContentFetcher({
            'source1': 'content1',
        });

        assertEquals(fetcher.canHandle('source2'), false);
        assertEquals(fetcher.canHandle('nonexistent'), false);
    });

    await t.step('should return false with empty content', () => {
        const fetcher = new PreFetchedContentFetcher({});

        assertEquals(fetcher.canHandle('source1'), false);
    });

    await t.step('should handle special characters in source names', () => {
        const fetcher = new PreFetchedContentFetcher({
            'http://example.com/filter.txt': 'content1',
            'https://example.org/list.txt': 'content2',
        });

        assertEquals(fetcher.canHandle('http://example.com/filter.txt'), true);
        assertEquals(fetcher.canHandle('https://example.org/list.txt'), true);
    });
});

Deno.test('PreFetchedContentFetcher - fetch', async (t) => {
    await t.step('should fetch existing content', async () => {
        const fetcher = new PreFetchedContentFetcher({
            'source1': 'content1',
            'source2': 'content2',
        });

        const result1 = await fetcher.fetch('source1');
        assertEquals(result1, 'content1');

        const result2 = await fetcher.fetch('source2');
        assertEquals(result2, 'content2');
    });

    await t.step('should throw error for missing content', async () => {
        const fetcher = new PreFetchedContentFetcher({
            'source1': 'content1',
        });

        await assertRejects(
            () => fetcher.fetch('nonexistent'),
            Error,
            'No pre-fetched content available for: nonexistent',
        );
    });

    await t.step('should handle empty string content', async () => {
        const fetcher = new PreFetchedContentFetcher({
            'empty': '',
        });

        const result = await fetcher.fetch('empty');
        assertEquals(result, '');
    });

    await t.step('should handle multiline content', async () => {
        const content = `||example.com^
||test.com^
||domain.org^`;
        const fetcher = new PreFetchedContentFetcher({
            'source1': content,
        });

        const result = await fetcher.fetch('source1');
        assertEquals(result, content);
    });

    await t.step('should work with Map-based initialization', async () => {
        const contentMap = new Map([
            ['source1', 'content1'],
            ['source2', 'content2'],
        ]);
        const fetcher = new PreFetchedContentFetcher(contentMap);

        const result = await fetcher.fetch('source1');
        assertEquals(result, 'content1');
    });
});

Deno.test('PreFetchedContentFetcher - addContent', async (t) => {
    await t.step('should add new content', async () => {
        const fetcher = new PreFetchedContentFetcher({});

        assertEquals(fetcher.canHandle('source1'), false);

        fetcher.addContent('source1', 'content1');

        assertEquals(fetcher.canHandle('source1'), true);
        const result = await fetcher.fetch('source1');
        assertEquals(result, 'content1');
    });

    await t.step('should replace existing content', async () => {
        const fetcher = new PreFetchedContentFetcher({
            'source1': 'old content',
        });

        fetcher.addContent('source1', 'new content');

        const result = await fetcher.fetch('source1');
        assertEquals(result, 'new content');
    });

    await t.step('should add multiple items', async () => {
        const fetcher = new PreFetchedContentFetcher({});

        fetcher.addContent('source1', 'content1');
        fetcher.addContent('source2', 'content2');
        fetcher.addContent('source3', 'content3');

        assertEquals(fetcher.canHandle('source1'), true);
        assertEquals(fetcher.canHandle('source2'), true);
        assertEquals(fetcher.canHandle('source3'), true);
    });
});

Deno.test('PreFetchedContentFetcher - removeContent', async (t) => {
    await t.step('should remove existing content', () => {
        const fetcher = new PreFetchedContentFetcher({
            'source1': 'content1',
            'source2': 'content2',
        });

        assertEquals(fetcher.canHandle('source1'), true);

        const result = fetcher.removeContent('source1');

        assertEquals(result, true);
        assertEquals(fetcher.canHandle('source1'), false);
    });

    await t.step('should return false when removing nonexistent content', () => {
        const fetcher = new PreFetchedContentFetcher({
            'source1': 'content1',
        });

        const result = fetcher.removeContent('nonexistent');

        assertEquals(result, false);
    });

    await t.step('should not affect other content', () => {
        const fetcher = new PreFetchedContentFetcher({
            'source1': 'content1',
            'source2': 'content2',
        });

        fetcher.removeContent('source1');

        assertEquals(fetcher.canHandle('source2'), true);
    });
});

Deno.test('PreFetchedContentFetcher - getSources', async (t) => {
    await t.step('should return all source identifiers', () => {
        const fetcher = new PreFetchedContentFetcher({
            'source1': 'content1',
            'source2': 'content2',
            'source3': 'content3',
        });

        const sources = fetcher.getSources();

        assertEquals(sources.length, 3);
        assertEquals(sources.includes('source1'), true);
        assertEquals(sources.includes('source2'), true);
        assertEquals(sources.includes('source3'), true);
    });

    await t.step('should return empty array for empty content', () => {
        const fetcher = new PreFetchedContentFetcher({});

        const sources = fetcher.getSources();

        assertEquals(sources.length, 0);
    });

    await t.step('should reflect additions', () => {
        const fetcher = new PreFetchedContentFetcher({
            'source1': 'content1',
        });

        fetcher.addContent('source2', 'content2');

        const sources = fetcher.getSources();

        assertEquals(sources.length, 2);
        assertEquals(sources.includes('source1'), true);
        assertEquals(sources.includes('source2'), true);
    });

    await t.step('should reflect removals', () => {
        const fetcher = new PreFetchedContentFetcher({
            'source1': 'content1',
            'source2': 'content2',
        });

        fetcher.removeContent('source1');

        const sources = fetcher.getSources();

        assertEquals(sources.length, 1);
        assertEquals(sources.includes('source2'), true);
    });
});

Deno.test('PreFetchedContentFetcher - real-world usage', async (t) => {
    await t.step('should work with filter list content', async () => {
        const filterContent = `! Title: My Filter List
! Homepage: https://example.com
||ads.example.com^
||tracker.test.com^
`;
        const fetcher = new PreFetchedContentFetcher({
            'https://example.com/filter.txt': filterContent,
        });

        assertEquals(fetcher.canHandle('https://example.com/filter.txt'), true);
        const result = await fetcher.fetch('https://example.com/filter.txt');
        assertEquals(result, filterContent);
    });

    await t.step('should handle multiple filter lists', async () => {
        const fetcher = new PreFetchedContentFetcher({
            'list1': '||example1.com^',
            'list2': '||example2.com^',
            'list3': '||example3.com^',
        });

        const sources = fetcher.getSources();
        assertEquals(sources.length, 3);

        for (const source of sources) {
            const content = await fetcher.fetch(source);
            assertEquals(typeof content, 'string');
            assertEquals(content.length > 0, true);
        }
    });

    await t.step('should support dynamic content loading', async () => {
        const fetcher = new PreFetchedContentFetcher({});

        // Initially empty
        assertEquals(fetcher.getSources().length, 0);

        // Dynamically add content
        fetcher.addContent('list1', '||ads.com^');
        fetcher.addContent('list2', '||tracker.com^');

        // Now has 2 sources
        assertEquals(fetcher.getSources().length, 2);

        // Can fetch them
        const content1 = await fetcher.fetch('list1');
        assertEquals(content1, '||ads.com^');

        // Can remove them
        fetcher.removeContent('list1');
        assertEquals(fetcher.getSources().length, 1);
    });
});
