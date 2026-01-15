import { assertEquals, assertExists } from '@std/assert';
import { FilterService } from './FilterService.ts';

const mockLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    trace: () => {},
};

Deno.test('FilterService - should create instance with logger', () => {
    const service = new FilterService(mockLogger);
    assertExists(service);
});

Deno.test('FilterService.downloadAll - should return empty array for empty sources', async () => {
    const service = new FilterService(mockLogger);
    const result = await service.downloadAll([]);
    assertEquals(result, []);
});

Deno.test('FilterService.downloadAll - should return empty array for null/undefined sources', async () => {
    const service = new FilterService(mockLogger);
    // @ts-ignore: Testing null/undefined handling
    const result = await service.downloadAll(null);
    assertEquals(result, []);
});

Deno.test('FilterService.prepareWildcards - should return empty array when no rules or sources', async () => {
    const service = new FilterService(mockLogger);
    const result = await service.prepareWildcards();
    assertEquals(result.length, 0);
});

Deno.test('FilterService.prepareWildcards - should return empty array for empty rules', async () => {
    const service = new FilterService(mockLogger);
    const result = await service.prepareWildcards([]);
    assertEquals(result.length, 0);
});

Deno.test('FilterService.prepareWildcards - should create wildcards from rules', async () => {
    const service = new FilterService(mockLogger);
    const result = await service.prepareWildcards(['*example*', '*test*']);

    assertEquals(result.length, 2);
    // Verify they are Wildcard instances that can test strings
    assertEquals(result[0].test('example.com'), true);
    assertEquals(result[1].test('test.org'), true);
});

Deno.test('FilterService.prepareWildcards - should deduplicate rules', async () => {
    const service = new FilterService(mockLogger);
    const result = await service.prepareWildcards(['*example*', '*example*', '*test*']);

    assertEquals(result.length, 2);
});

Deno.test('FilterService.prepareWildcards - should filter out empty/falsy rules', async () => {
    const service = new FilterService(mockLogger);
    const result = await service.prepareWildcards(['*example*', '', '*test*']);

    assertEquals(result.length, 2);
});

Deno.test('FilterService.prepareWildcards - should handle undefined rules array', async () => {
    const service = new FilterService(mockLogger);
    const result = await service.prepareWildcards(undefined, []);

    assertEquals(result.length, 0);
});

Deno.test('FilterService.prepareWildcards - should handle empty sources array', async () => {
    const service = new FilterService(mockLogger);
    const result = await service.prepareWildcards(['*example*'], []);

    assertEquals(result.length, 1);
});

Deno.test('FilterService.prepareWildcards - wildcards should match correctly', async () => {
    const service = new FilterService(mockLogger);
    const result = await service.prepareWildcards(['||example.org^', '*tracking*']);

    assertEquals(result.length, 2);
    // Test exact match
    assertEquals(result[0].test('||example.org^'), true);
    assertEquals(result[0].test('||other.org^'), false);
    // Test wildcard match
    assertEquals(result[1].test('tracking.example.com'), true);
    assertEquals(result[1].test('safe.example.com'), false);
});
