import { assertEquals } from '@std/assert';
import { CompressTransformation } from '../../src/transformations/CompressTransformation.ts';

Deno.test('CompressTransformation - should convert hosts rules to adblock format', () => {
    const transformation = new CompressTransformation();
    const rules = ['0.0.0.0 example.org'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('CompressTransformation - should convert plain domain to adblock format', () => {
    const transformation = new CompressTransformation();
    const rules = ['example.org'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('CompressTransformation - should remove redundant subdomain rules', () => {
    const transformation = new CompressTransformation();
    const rules = [
        '||example.org^',
        '||sub.example.org^',
    ];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('CompressTransformation - should keep non-redundant subdomain rules', () => {
    const transformation = new CompressTransformation();
    const rules = [
        '||sub.example.org^',
        '||other.com^',
    ];
    const result = transformation.executeSync(rules);
    assertEquals(result, [
        '||sub.example.org^',
        '||other.com^',
    ]);
});

Deno.test('CompressTransformation - should handle hosts rules with multiple domains', () => {
    const transformation = new CompressTransformation();
    const rules = ['0.0.0.0 example.org www.example.org'];
    const result = transformation.executeSync(rules);
    // www.example.org should be removed as redundant
    assertEquals(result, ['||example.org^']);
});

Deno.test('CompressTransformation - should keep rules that cannot be compressed', () => {
    const transformation = new CompressTransformation();
    const rules = [
        '||example.org^',
        '||example.org^$important',
    ];
    const result = transformation.executeSync(rules);
    assertEquals(result.length, 2);
});

Deno.test('CompressTransformation - should handle empty array', () => {
    const transformation = new CompressTransformation();
    const result = transformation.executeSync([]);
    assertEquals(result, []);
});

Deno.test('CompressTransformation - should deduplicate identical hosts rules', () => {
    const transformation = new CompressTransformation();
    const rules = [
        '0.0.0.0 example.org',
        '0.0.0.0 example.org',
    ];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});
