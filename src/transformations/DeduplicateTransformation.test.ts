import { assertEquals } from '@std/assert';
import { DeduplicateTransformation } from '../../src/transformations/DeduplicateTransformation.ts';

Deno.test('DeduplicateTransformation - should remove duplicate rules', () => {
    const transformation = new DeduplicateTransformation();
    const rules = [
        '||example.org^',
        '||test.com^',
        '||example.org^',
    ];
    const result = transformation.executeSync(rules);
    assertEquals(result, [
        '||example.org^',
        '||test.com^',
    ]);
});

Deno.test('DeduplicateTransformation - should preserve order', () => {
    const transformation = new DeduplicateTransformation();
    const rules = [
        '||first.com^',
        '||second.com^',
        '||third.com^',
    ];
    const result = transformation.executeSync(rules);
    assertEquals(result, [
        '||first.com^',
        '||second.com^',
        '||third.com^',
    ]);
});

Deno.test('DeduplicateTransformation - should remove preceding comments for duplicates', () => {
    const transformation = new DeduplicateTransformation();
    const rules = [
        '||example.org^',
        '! Comment for duplicate',
        '||example.org^',
    ];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('DeduplicateTransformation - should keep comments for first occurrence', () => {
    const transformation = new DeduplicateTransformation();
    const rules = [
        '! Comment for first',
        '||example.org^',
        '||example.org^',
    ];
    const result = transformation.executeSync(rules);
    assertEquals(result, [
        '! Comment for first',
        '||example.org^',
    ]);
});

Deno.test('DeduplicateTransformation - should handle empty array', () => {
    const transformation = new DeduplicateTransformation();
    const result = transformation.executeSync([]);
    assertEquals(result, []);
});

Deno.test('DeduplicateTransformation - should not deduplicate comments', () => {
    const transformation = new DeduplicateTransformation();
    const rules = [
        '! Comment',
        '||example.org^',
        '! Comment',
    ];
    const result = transformation.executeSync(rules);
    assertEquals(result, [
        '! Comment',
        '||example.org^',
        '! Comment',
    ]);
});
