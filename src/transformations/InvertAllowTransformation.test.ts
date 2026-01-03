import { assertEquals } from '@std/assert';
import { InvertAllowTransformation } from '../../src/transformations/InvertAllowTransformation.ts';

Deno.test('InvertAllowTransformation - should invert blocking rules', () => {
    const transformation = new InvertAllowTransformation();
    const rules = ['||example.org^'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['@@||example.org^']);
});

Deno.test('InvertAllowTransformation - should not invert allow rules', () => {
    const transformation = new InvertAllowTransformation();
    const rules = ['@@||example.org^'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['@@||example.org^']);
});

Deno.test('InvertAllowTransformation - should not invert comments', () => {
    const transformation = new InvertAllowTransformation();
    const rules = ['! Comment'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['! Comment']);
});

Deno.test('InvertAllowTransformation - should not invert hosts rules', () => {
    const transformation = new InvertAllowTransformation();
    const rules = ['0.0.0.0 example.org'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['0.0.0.0 example.org']);
});

Deno.test('InvertAllowTransformation - should handle empty array', () => {
    const transformation = new InvertAllowTransformation();
    const result = transformation.executeSync([]);
    assertEquals(result, []);
});

Deno.test('InvertAllowTransformation - should handle multiple rules', () => {
    const transformation = new InvertAllowTransformation();
    const rules = [
        '||example.org^',
        '@@||allowed.org^',
        '! Comment',
        '||test.com^',
    ];
    const result = transformation.executeSync(rules);
    assertEquals(result, [
        '@@||example.org^',
        '@@||allowed.org^',
        '! Comment',
        '@@||test.com^',
    ]);
});
