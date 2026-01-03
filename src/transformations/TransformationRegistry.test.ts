import { assertEquals, assertExists } from '@std/assert';
import { TransformationRegistry, TransformationPipeline } from './TransformationRegistry.ts';
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
