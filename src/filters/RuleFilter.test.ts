/**
 * Tests for RuleFilter
 */

import { assertEquals, assertRejects } from '@std/assert';
import { RuleFilter } from './RuleFilter.ts';
import { FilterService } from '../services/FilterService.ts';
import { IFilterable } from '../types/index.ts';
import { silentLogger } from '../utils/index.ts';

// Create a test filterable configuration
function createFilterable(overrides: Partial<IFilterable> = {}): IFilterable {
    return {
        ...overrides,
    } as IFilterable;
}

Deno.test('RuleFilter - applyExclusions', async (t) => {
    await t.step('should return rules unchanged when no exclusions', async () => {
        const filterService = new FilterService(silentLogger);
        const ruleFilter = new RuleFilter(filterService, silentLogger);
        const rules = ['||example.com^', '||test.com^', '||domain.org^'];
        const filterable = createFilterable({});

        const result = await ruleFilter.applyExclusions(rules, filterable);

        assertEquals(result, rules);
    });

    await t.step('should return rules unchanged when empty exclusions array', async () => {
        const filterService = new FilterService(silentLogger);
        const ruleFilter = new RuleFilter(filterService, silentLogger);
        const rules = ['||example.com^', '||test.com^'];
        const filterable = createFilterable({ exclusions: [] });

        const result = await ruleFilter.applyExclusions(rules, filterable);

        assertEquals(result, rules);
    });

    await t.step('should exclude rules matching plain string pattern', async () => {
        const filterService = new FilterService(silentLogger);
        const ruleFilter = new RuleFilter(filterService, silentLogger);
        const rules = [
            '||example.com^',
            '||test.com^',
            '||domain.org^',
        ];
        const filterable = createFilterable({
            exclusions: ['example.com'],
        });

        const result = await ruleFilter.applyExclusions(rules, filterable);

        assertEquals(result.length, 2);
        assertEquals(result.includes('||example.com^'), false);
        assertEquals(result.includes('||test.com^'), true);
        assertEquals(result.includes('||domain.org^'), true);
    });

    await t.step('should exclude rules matching wildcard pattern', async () => {
        const filterService = new FilterService(silentLogger);
        const ruleFilter = new RuleFilter(filterService, silentLogger);
        const rules = [
            '||example.com^',
            '||example.org^',
            '||test.com^',
        ];
        const filterable = createFilterable({
            exclusions: ['example.*'],
        });

        const result = await ruleFilter.applyExclusions(rules, filterable);

        assertEquals(result.length, 1);
        assertEquals(result[0], '||test.com^');
    });

    await t.step('should exclude rules matching multiple patterns', async () => {
        const filterService = new FilterService(silentLogger);
        const ruleFilter = new RuleFilter(filterService, silentLogger);
        const rules = [
            '||example.com^',
            '||test.com^',
            '||domain.org^',
            '||site.net^',
        ];
        const filterable = createFilterable({
            exclusions: ['example.com', 'test.com'],
        });

        const result = await ruleFilter.applyExclusions(rules, filterable);

        assertEquals(result.length, 2);
        assertEquals(result.includes('||domain.org^'), true);
        assertEquals(result.includes('||site.net^'), true);
    });

    await t.step('should handle exclusions_sources', async () => {
        // Create a temporary exclusions file
        const exclusionsFile = './test_exclusions.txt';
        await Deno.writeTextFile(exclusionsFile, 'example.com\ntest.com\n');

        try {
            const filterService = new FilterService(silentLogger);
            const ruleFilter = new RuleFilter(filterService, silentLogger);
            const rules = [
                '||example.com^',
                '||test.com^',
                '||domain.org^',
            ];
            const filterable = createFilterable({
                exclusions_sources: [exclusionsFile],
            });

            const result = await ruleFilter.applyExclusions(rules, filterable);

            assertEquals(result.length, 1);
            assertEquals(result[0], '||domain.org^');
        } finally {
            // Cleanup
            await Deno.remove(exclusionsFile);
        }
    });

    await t.step('should combine exclusions and exclusions_sources', async () => {
        // Create a temporary exclusions file
        const exclusionsFile = './test_exclusions.txt';
        await Deno.writeTextFile(exclusionsFile, 'test.com\n');

        try {
            const filterService = new FilterService(silentLogger);
            const ruleFilter = new RuleFilter(filterService, silentLogger);
            const rules = [
                '||example.com^',
                '||test.com^',
                '||domain.org^',
            ];
            const filterable = createFilterable({
                exclusions: ['example.com'],
                exclusions_sources: [exclusionsFile],
            });

            const result = await ruleFilter.applyExclusions(rules, filterable);

            assertEquals(result.length, 1);
            assertEquals(result[0], '||domain.org^');
        } finally {
            // Cleanup
            await Deno.remove(exclusionsFile);
        }
    });

    await t.step('should throw error on invalid exclusions_sources', async () => {
        const filterService = new FilterService(silentLogger);
        const ruleFilter = new RuleFilter(filterService, silentLogger);
        const rules = ['||example.com^'];
        const filterable = createFilterable({
            exclusions_sources: ['/nonexistent/file.txt'],
        });

        await assertRejects(
            () => ruleFilter.applyExclusions(rules, filterable),
            Error,
            'Rule exclusion failed',
        );
    });
});

Deno.test('RuleFilter - applyInclusions', async (t) => {
    await t.step('should return rules unchanged when no inclusions', async () => {
        const filterService = new FilterService(silentLogger);
        const ruleFilter = new RuleFilter(filterService, silentLogger);
        const rules = ['||example.com^', '||test.com^', '||domain.org^'];
        const filterable = createFilterable({});

        const result = await ruleFilter.applyInclusions(rules, filterable);

        assertEquals(result, rules);
    });

    await t.step('should return rules unchanged when empty inclusions array', async () => {
        const filterService = new FilterService(silentLogger);
        const ruleFilter = new RuleFilter(filterService, silentLogger);
        const rules = ['||example.com^', '||test.com^'];
        const filterable = createFilterable({ inclusions: [] });

        const result = await ruleFilter.applyInclusions(rules, filterable);

        assertEquals(result, rules);
    });

    await t.step('should include only rules matching plain string pattern', async () => {
        const filterService = new FilterService(silentLogger);
        const ruleFilter = new RuleFilter(filterService, silentLogger);
        const rules = [
            '||example.com^',
            '||test.com^',
            '||domain.org^',
        ];
        const filterable = createFilterable({
            inclusions: ['example.com'],
        });

        const result = await ruleFilter.applyInclusions(rules, filterable);

        assertEquals(result.length, 1);
        assertEquals(result[0], '||example.com^');
    });

    await t.step('should include only rules matching wildcard pattern', async () => {
        const filterService = new FilterService(silentLogger);
        const ruleFilter = new RuleFilter(filterService, silentLogger);
        const rules = [
            '||example.com^',
            '||example.org^',
            '||test.com^',
        ];
        const filterable = createFilterable({
            inclusions: ['example.*'],
        });

        const result = await ruleFilter.applyInclusions(rules, filterable);

        assertEquals(result.length, 2);
        assertEquals(result.includes('||example.com^'), true);
        assertEquals(result.includes('||example.org^'), true);
    });

    await t.step('should include rules matching multiple patterns', async () => {
        const filterService = new FilterService(silentLogger);
        const ruleFilter = new RuleFilter(filterService, silentLogger);
        const rules = [
            '||example.com^',
            '||test.com^',
            '||domain.org^',
            '||site.net^',
        ];
        const filterable = createFilterable({
            inclusions: ['example.com', 'test.com'],
        });

        const result = await ruleFilter.applyInclusions(rules, filterable);

        assertEquals(result.length, 2);
        assertEquals(result.includes('||example.com^'), true);
        assertEquals(result.includes('||test.com^'), true);
    });

    await t.step('should handle inclusions_sources', async () => {
        // Create a temporary inclusions file
        const inclusionsFile = './test_inclusions.txt';
        await Deno.writeTextFile(inclusionsFile, 'example.com\ntest.com\n');

        try {
            const filterService = new FilterService(silentLogger);
            const ruleFilter = new RuleFilter(filterService, silentLogger);
            const rules = [
                '||example.com^',
                '||test.com^',
                '||domain.org^',
            ];
            const filterable = createFilterable({
                inclusions_sources: [inclusionsFile],
            });

            const result = await ruleFilter.applyInclusions(rules, filterable);

            assertEquals(result.length, 2);
            assertEquals(result.includes('||example.com^'), true);
            assertEquals(result.includes('||test.com^'), true);
        } finally {
            // Cleanup
            await Deno.remove(inclusionsFile);
        }
    });

    await t.step('should combine inclusions and inclusions_sources', async () => {
        // Create a temporary inclusions file
        const inclusionsFile = './test_inclusions.txt';
        await Deno.writeTextFile(inclusionsFile, 'test.com\n');

        try {
            const filterService = new FilterService(silentLogger);
            const ruleFilter = new RuleFilter(filterService, silentLogger);
            const rules = [
                '||example.com^',
                '||test.com^',
                '||domain.org^',
            ];
            const filterable = createFilterable({
                inclusions: ['example.com'],
                inclusions_sources: [inclusionsFile],
            });

            const result = await ruleFilter.applyInclusions(rules, filterable);

            assertEquals(result.length, 2);
            assertEquals(result.includes('||example.com^'), true);
            assertEquals(result.includes('||test.com^'), true);
        } finally {
            // Cleanup
            await Deno.remove(inclusionsFile);
        }
    });

    await t.step('should throw error on invalid inclusions_sources', async () => {
        const filterService = new FilterService(silentLogger);
        const ruleFilter = new RuleFilter(filterService, silentLogger);
        const rules = ['||example.com^'];
        const filterable = createFilterable({
            inclusions_sources: ['/nonexistent/file.txt'],
        });

        await assertRejects(
            () => ruleFilter.applyInclusions(rules, filterable),
            Error,
            'Rule inclusion failed',
        );
    });
});

Deno.test('RuleFilter - pattern optimization', async (t) => {
    await t.step('should efficiently handle plain string patterns', async () => {
        const filterService = new FilterService(silentLogger);
        const ruleFilter = new RuleFilter(filterService, silentLogger);
        const rules = Array.from({ length: 1000 }, (_, i) => `||example${i}.com^`);
        const filterable = createFilterable({
            exclusions: ['example500'],
        });

        const result = await ruleFilter.applyExclusions(rules, filterable);

        assertEquals(result.length, 999);
        assertEquals(result.includes('||example500.com^'), false);
    });

    await t.step('should efficiently handle regex patterns', async () => {
        const filterService = new FilterService(silentLogger);
        const ruleFilter = new RuleFilter(filterService, silentLogger);
        const rules = [
            '||example.com^',
            '||example.org^',
            '||example.net^',
            '||test.com^',
        ];
        const filterable = createFilterable({
            exclusions: ['example\\.(com|org|net)'],
        });

        const result = await ruleFilter.applyExclusions(rules, filterable);

        assertEquals(result.length, 1);
        assertEquals(result[0], '||test.com^');
    });

    await t.step('should handle mixed plain and regex patterns', async () => {
        const filterService = new FilterService(silentLogger);
        const ruleFilter = new RuleFilter(filterService, silentLogger);
        const rules = [
            '||example.com^',
            '||test.com^',
            '||domain.org^',
            '||site.net^',
        ];
        const filterable = createFilterable({
            exclusions: ['test.com', 'domain.*'],
        });

        const result = await ruleFilter.applyExclusions(rules, filterable);

        assertEquals(result.length, 2);
        assertEquals(result.includes('||example.com^'), true);
        assertEquals(result.includes('||site.net^'), true);
    });
});
