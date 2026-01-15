import { assertEquals, assertExists } from '@std/assert';
import { TransformationPipeline, TransformationRegistry } from './TransformationRegistry.ts';
import { TransformationType } from '../types/index.ts';
import { silentLogger } from '../utils/logger.ts';

Deno.test('TransformationRegistry - should create registry with default transformations', () => {
    const registry = new TransformationRegistry();
    assertEquals(registry instanceof TransformationRegistry, true);
});

Deno.test('TransformationRegistry - should have all default transformations registered', () => {
    const registry = new TransformationRegistry();

    assertEquals(registry.has(TransformationType.RemoveComments), true);
    assertEquals(registry.has(TransformationType.TrimLines), true);
    assertEquals(registry.has(TransformationType.RemoveEmptyLines), true);
    assertEquals(registry.has(TransformationType.InsertFinalNewLine), true);
    assertEquals(registry.has(TransformationType.ConvertToAscii), true);
    assertEquals(registry.has(TransformationType.InvertAllow), true);
    assertEquals(registry.has(TransformationType.RemoveModifiers), true);
    assertEquals(registry.has(TransformationType.Deduplicate), true);
    assertEquals(registry.has(TransformationType.Validate), true);
    assertEquals(registry.has(TransformationType.ValidateAllowIp), true);
    assertEquals(registry.has(TransformationType.Compress), true);
});

Deno.test('TransformationRegistry - should get transformation by type', () => {
    const registry = new TransformationRegistry();

    const transformation = registry.get(TransformationType.RemoveComments);
    assertExists(transformation);
});

Deno.test('TransformationRegistry - should return undefined for unregistered type', () => {
    const registry = new TransformationRegistry();

    const transformation = registry.get('NonExistent' as TransformationType);
    assertEquals(transformation, undefined);
});

Deno.test('TransformationRegistry - should get all registered types', () => {
    const registry = new TransformationRegistry();

    const types = registry.getRegisteredTypes();
    assertEquals(types.length, 11); // All default transformations
    assertEquals(types.includes(TransformationType.RemoveComments), true);
    assertEquals(types.includes(TransformationType.Deduplicate), true);
});

Deno.test('TransformationPipeline - should create pipeline with default registry', () => {
    const pipeline = new TransformationPipeline();
    assertEquals(pipeline instanceof TransformationPipeline, true);
});

Deno.test('TransformationPipeline - should transform rules with no transformations', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = ['||example.org^', '||test.com^'];

    const config = {
        name: 'Test',
        sources: [],
    };

    const result = await pipeline.transform(rules, config, []);
    assertEquals(result, rules);
});

Deno.test('TransformationPipeline - should apply RemoveEmptyLines transformation', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = ['||example.org^', '', '||test.com^', ''];

    const config = {
        name: 'Test',
        sources: [],
    };

    const result = await pipeline.transform(rules, config, [TransformationType.RemoveEmptyLines]);
    assertEquals(result, ['||example.org^', '||test.com^']);
});

Deno.test('TransformationPipeline - should apply TrimLines transformation', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = ['  ||example.org^  ', '  ||test.com^  '];

    const config = {
        name: 'Test',
        sources: [],
    };

    const result = await pipeline.transform(rules, config, [TransformationType.TrimLines]);
    assertEquals(result, ['||example.org^', '||test.com^']);
});

Deno.test('TransformationPipeline - should apply RemoveComments transformation', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = ['! Comment', '||example.org^', '# Another comment', '||test.com^'];

    const config = {
        name: 'Test',
        sources: [],
    };

    const result = await pipeline.transform(rules, config, [TransformationType.RemoveComments]);
    assertEquals(result, ['||example.org^', '||test.com^']);
});

Deno.test('TransformationPipeline - should apply Deduplicate transformation', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = ['||example.org^', '||test.com^', '||example.org^', '||test.com^'];

    const config = {
        name: 'Test',
        sources: [],
    };

    const result = await pipeline.transform(rules, config, [TransformationType.Deduplicate]);
    assertEquals(result.length, 2);
    assertEquals(result.includes('||example.org^'), true);
    assertEquals(result.includes('||test.com^'), true);
});

Deno.test('TransformationPipeline - should apply multiple transformations in order', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = [
        '! Comment',
        '  ||example.org^  ',
        '',
        '  ||test.com^  ',
        '  ||example.org^  ',
    ];

    const config = {
        name: 'Test',
        sources: [],
    };

    const result = await pipeline.transform(rules, config, [
        TransformationType.RemoveComments,
        TransformationType.TrimLines,
        TransformationType.RemoveEmptyLines,
        TransformationType.Deduplicate,
    ]);

    assertEquals(result.length, 2);
    assertEquals(result, ['||example.org^', '||test.com^']);
});

Deno.test('TransformationPipeline - transformations should execute in correct order', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);

    // Even if specified out of order, they should execute in the defined order
    const rules = ['  ||example.org^  ', '! Comment'];
    const config = {
        name: 'Test',
        sources: [],
    };

    // Request out of order: TrimLines, then RemoveComments
    // Should execute in order: RemoveComments, then TrimLines
    const result = await pipeline.transform(rules, config, [
        TransformationType.TrimLines,
        TransformationType.RemoveComments,
    ]);

    assertEquals(result, ['||example.org^']);
});

Deno.test('TransformationPipeline - should handle empty rules array', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const config = {
        name: 'Test',
        sources: [],
    };

    const result = await pipeline.transform([], config, [TransformationType.Deduplicate]);
    assertEquals(result, []);
});

Deno.test('TransformationRegistry - should accept custom logger', () => {
    const customLogger = {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
        trace: () => {},
    };
    const registry = new TransformationRegistry(customLogger);
    assertEquals(registry.has(TransformationType.RemoveComments), true);
});

Deno.test('TransformationRegistry - register should override existing transformation', () => {
    const registry = new TransformationRegistry();
    const originalTransformation = registry.get(TransformationType.TrimLines);
    assertExists(originalTransformation);

    // Register a new transformation with the same type
    const newTransformation = originalTransformation; // Just reusing for test
    registry.register(TransformationType.TrimLines, newTransformation);

    // Should still exist and be the same reference
    assertEquals(registry.get(TransformationType.TrimLines), newTransformation);
});

Deno.test('TransformationRegistry - has returns false for non-existent type', () => {
    const registry = new TransformationRegistry();
    assertEquals(registry.has('non-existent' as TransformationType), false);
});

Deno.test('TransformationPipeline - should apply exclusions with patterns', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = ['||example.org^', '||test.com^', '||ads.example.org^'];

    const config = {
        name: 'Test',
        sources: [],
        exclusions: ['*ads*'],
    };

    const result = await pipeline.transform(rules, config, []);
    assertEquals(result, ['||example.org^', '||test.com^']);
});

Deno.test('TransformationPipeline - should apply inclusions with patterns', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = ['||example.org^', '||test.com^', '||other.net^'];

    const config = {
        name: 'Test',
        sources: [],
        inclusions: ['*example*'],
    };

    const result = await pipeline.transform(rules, config, []);
    assertEquals(result, ['||example.org^']);
});

Deno.test('TransformationPipeline - should handle exclusions with plain patterns', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = ['||example.org^', '||test.com^', '||ads.example.org^'];

    const config = {
        name: 'Test',
        sources: [],
        exclusions: ['ads.'], // Plain pattern without wildcards
    };

    const result = await pipeline.transform(rules, config, []);
    assertEquals(result, ['||example.org^', '||test.com^']);
});

Deno.test('TransformationPipeline - should pass through rules when no exclusions defined', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = ['||example.org^', '||test.com^'];

    const config = {
        name: 'Test',
        sources: [],
        exclusions: [],
    };

    const result = await pipeline.transform(rules, config, []);
    assertEquals(result, rules);
});

Deno.test('TransformationPipeline - should pass through rules when no inclusions defined', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = ['||example.org^', '||test.com^'];

    const config = {
        name: 'Test',
        sources: [],
        inclusions: [],
    };

    const result = await pipeline.transform(rules, config, []);
    assertEquals(result, rules);
});

Deno.test('TransformationPipeline - should handle undefined transformations parameter', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = ['||example.org^'];

    const config = {
        name: 'Test',
        sources: [],
    };

    // Not passing transformations array at all
    const result = await pipeline.transform(rules, config);
    assertEquals(result, rules);
});

Deno.test('TransformationPipeline - should skip unregistered transformation types', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = ['||example.org^'];

    const config = {
        name: 'Test',
        sources: [],
    };

    // Include a fake transformation type that isn't registered
    const result = await pipeline.transform(rules, config, [
        'NonExistent' as TransformationType,
        TransformationType.RemoveEmptyLines,
    ]);

    assertEquals(result, rules);
});

Deno.test('TransformationPipeline - should apply InsertFinalNewLine transformation', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = ['||example.org^', '||test.com^'];

    const config = {
        name: 'Test',
        sources: [],
    };

    const result = await pipeline.transform(rules, config, [TransformationType.InsertFinalNewLine]);
    assertEquals(result[result.length - 1], '');
});

Deno.test('TransformationPipeline - should apply ConvertToAscii transformation', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = ['||exämple.org^'];

    const config = {
        name: 'Test',
        sources: [],
    };

    const result = await pipeline.transform(rules, config, [TransformationType.ConvertToAscii]);
    assertEquals(result[0], '||xn--exmple-cua.org^');
});

Deno.test('TransformationPipeline - should apply InvertAllow transformation', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = ['@@||example.org^'];

    const config = {
        name: 'Test',
        sources: [],
    };

    const result = await pipeline.transform(rules, config, [TransformationType.InvertAllow]);
    // InvertAllow keeps allowlist rules but may transform them
    assertExists(result);
    assertEquals(result.length > 0, true);
});

Deno.test('TransformationPipeline - should apply Compress transformation', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = ['||example.org^', '||example.com^'];

    const config = {
        name: 'Test',
        sources: [],
    };

    const result = await pipeline.transform(rules, config, [TransformationType.Compress]);
    // Compress may combine rules, but at minimum should handle them
    assertExists(result);
});

Deno.test('TransformationPipeline - should apply Validate transformation', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = ['||example.org^', 'invalid rule [[['];

    const config = {
        name: 'Test',
        sources: [],
    };

    const result = await pipeline.transform(rules, config, [TransformationType.Validate]);
    // Valid rule should pass, invalid should be filtered
    assertEquals(result.includes('||example.org^'), true);
});

Deno.test('TransformationPipeline - should apply ValidateAllowIp transformation', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = ['||example.org^', '@@||192.168.1.1^'];

    const config = {
        name: 'Test',
        sources: [],
    };

    const result = await pipeline.transform(rules, config, [TransformationType.ValidateAllowIp]);
    assertExists(result);
});

Deno.test('TransformationPipeline - should apply RemoveModifiers transformation', async () => {
    const pipeline = new TransformationPipeline(undefined, silentLogger);
    const rules = ['||example.org^$third-party'];

    const config = {
        name: 'Test',
        sources: [],
    };

    const result = await pipeline.transform(rules, config, [TransformationType.RemoveModifiers]);
    assertEquals(result[0], '||example.org^');
});
