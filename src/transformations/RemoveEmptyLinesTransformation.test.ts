import { assertEquals } from '@std/assert';
import { RemoveEmptyLinesTransformation } from '../../src/transformations/RemoveEmptyLinesTransformation.ts';

Deno.test('RemoveEmptyLinesTransformation - should remove empty lines', () => {
    const transformation = new RemoveEmptyLinesTransformation();
    const rules = [
        '||example.org^',
        '',
        '||test.com^',
    ];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^', '||test.com^']);
});

Deno.test('RemoveEmptyLinesTransformation - should remove whitespace-only lines', () => {
    const transformation = new RemoveEmptyLinesTransformation();
    const rules = [
        '||example.org^',
        '   ',
        '||test.com^',
    ];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^', '||test.com^']);
});

Deno.test('RemoveEmptyLinesTransformation - should handle multiple empty lines', () => {
    const transformation = new RemoveEmptyLinesTransformation();
    const rules = ['', '', '||example.org^', '', ''];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('RemoveEmptyLinesTransformation - should handle empty array', () => {
    const transformation = new RemoveEmptyLinesTransformation();
    const result = transformation.executeSync([]);
    assertEquals(result, []);
});
