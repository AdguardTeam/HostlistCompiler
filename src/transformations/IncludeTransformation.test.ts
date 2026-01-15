import { assertEquals, assertExists } from '@std/assert';
import { IncludeTransformation } from './IncludeTransformation.ts';
import { Wildcard } from '../utils/Wildcard.ts';

Deno.test('IncludeTransformation - should include only matching rules', () => {
    const rules = [
        '||example.org^',
        '||test.com^',
        '||example.com^',
    ];
    const wildcards = [new Wildcard('*example*')];

    const result = IncludeTransformation.includeWithWildcards(rules, wildcards);

    assertEquals(result, ['||example.org^', '||example.com^']);
});

Deno.test('IncludeTransformation - should include rules matching any pattern', () => {
    const rules = [
        '||ads.example.org^',
        '||tracking.test.com^',
        '||safe.org^',
        '||banner.other.com^',
    ];
    const wildcards = [
        new Wildcard('*example*'),
        new Wildcard('*test*'),
    ];

    const result = IncludeTransformation.includeWithWildcards(rules, wildcards);

    assertEquals(result, ['||ads.example.org^', '||tracking.test.com^']);
});

Deno.test('IncludeTransformation - should return empty when no wildcards', () => {
    const rules = [
        '||example.org^',
        '||test.com^',
    ];

    const result = IncludeTransformation.includeWithWildcards(rules, []);

    assertEquals(result, []);
});

Deno.test('IncludeTransformation - should handle empty rules array', () => {
    const wildcards = [new Wildcard('*example*')];

    const result = IncludeTransformation.includeWithWildcards([], wildcards);

    assertEquals(result, []);
});

Deno.test('IncludeTransformation - should handle exact matches', () => {
    const rules = [
        '||example.org^',
        '||test.com^',
        '||other.net^',
    ];
    const wildcards = [new Wildcard('||example.org^')];

    const result = IncludeTransformation.includeWithWildcards(rules, wildcards);

    assertEquals(result, ['||example.org^']);
});

Deno.test('IncludeTransformation - should handle wildcard at start', () => {
    const rules = [
        '||example.org^',
        '||my-example.org^',
        '||test.com^',
    ];
    const wildcards = [new Wildcard('*example.org^')];

    const result = IncludeTransformation.includeWithWildcards(rules, wildcards);

    assertEquals(result, ['||example.org^', '||my-example.org^']);
});

Deno.test('IncludeTransformation - should handle wildcard at end', () => {
    const rules = [
        '||example.org^',
        '||example.com^',
        '||test.com^',
    ];
    const wildcards = [new Wildcard('||example*')];

    const result = IncludeTransformation.includeWithWildcards(rules, wildcards);

    assertEquals(result, ['||example.org^', '||example.com^']);
});

Deno.test('IncludeTransformation - should return empty for non-matching rules', () => {
    const rules = [
        '||example.org^',
        '||test.com^',
        '||other.net^',
    ];
    const wildcards = [new Wildcard('*nonexistent*')];

    const result = IncludeTransformation.includeWithWildcards(rules, wildcards);

    assertEquals(result, []);
});

Deno.test('IncludeTransformation - should handle case-insensitive matching', () => {
    const rules = [
        '||Example.org^',
        '||example.org^',
        '||test.com^',
    ];
    const wildcards = [new Wildcard('*example.org*')];

    const result = IncludeTransformation.includeWithWildcards(rules, wildcards);

    // Should include both case variants
    assertEquals(result, ['||Example.org^', '||example.org^']);
});

Deno.test('IncludeTransformation - should include all matching rules', () => {
    const rules = [
        '||ads.example.com^',
        '||tracker.example.org^',
        '||safe.org^',
        '||analytics.example.net^',
    ];
    const wildcards = [new Wildcard('*example*')];

    const result = IncludeTransformation.includeWithWildcards(rules, wildcards);

    assertEquals(result.length, 3);
    assertEquals(result.includes('||ads.example.com^'), true);
    assertEquals(result.includes('||tracker.example.org^'), true);
    assertEquals(result.includes('||analytics.example.net^'), true);
});

// execute() method tests
import type { ITransformationContext } from '../types/index.ts';

const mockLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    trace: () => {},
};

Deno.test('IncludeTransformation.execute - should return all rules when no inclusions configured', async () => {
    const transformation = new IncludeTransformation();
    const rules = ['||example.org^', '||test.com^'];

    const context = {
        configuration: { name: 'test', sources: [] },
        logger: mockLogger,
    } as ITransformationContext;

    const result = await transformation.execute(rules, context);
    assertEquals(result, rules);
});

Deno.test('IncludeTransformation.execute - should return all rules when inclusions is empty array', async () => {
    const transformation = new IncludeTransformation();
    const rules = ['||example.org^', '||test.com^'];

    const context = {
        configuration: { name: 'test', sources: [], inclusions: [] },
        logger: mockLogger,
    } as ITransformationContext;

    const result = await transformation.execute(rules, context);
    assertEquals(result, rules);
});

Deno.test('IncludeTransformation.execute - should return all rules when no context provided', async () => {
    const transformation = new IncludeTransformation();
    const rules = ['||example.org^', '||test.com^'];

    const result = await transformation.execute(rules);
    assertEquals(result, rules);
});

Deno.test('IncludeTransformation.execute - should include only rules matching inclusion patterns', async () => {
    const transformation = new IncludeTransformation();
    const rules = ['||example.org^', '||test.com^', '||example.com^'];

    const context = {
        configuration: { name: 'test', sources: [], inclusions: ['*example*'] },
        logger: mockLogger,
    } as ITransformationContext;

    const result = await transformation.execute(rules, context);
    assertEquals(result, ['||example.org^', '||example.com^']);
});

Deno.test('IncludeTransformation.execute - should handle multiple inclusion patterns', async () => {
    const transformation = new IncludeTransformation();
    const rules = ['||example.org^', '||test.com^', '||other.net^'];

    const context = {
        configuration: { name: 'test', sources: [], inclusions: ['*example*', '*test*'] },
        logger: mockLogger,
    } as ITransformationContext;

    const result = await transformation.execute(rules, context);
    assertEquals(result, ['||example.org^', '||test.com^']);
});

Deno.test('IncludeTransformation - should have correct name and type properties', () => {
    const transformation = new IncludeTransformation();
    assertEquals(transformation.name, 'Include');
    assertExists(transformation.type);
});
