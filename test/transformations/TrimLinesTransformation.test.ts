import { assertEquals } from '@std/assert';
import { TrimLinesTransformation } from '../../src/transformations/TrimLinesTransformation.ts';

Deno.test('TrimLinesTransformation - should trim leading spaces', () => {
    const transformation = new TrimLinesTransformation();
    const rules = ['  ||example.org^'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('TrimLinesTransformation - should trim trailing spaces', () => {
    const transformation = new TrimLinesTransformation();
    const rules = ['||example.org^  '];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('TrimLinesTransformation - should trim tabs', () => {
    const transformation = new TrimLinesTransformation();
    const rules = ['\t||example.org^\t'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('TrimLinesTransformation - should trim mixed whitespace', () => {
    const transformation = new TrimLinesTransformation();
    const rules = ['  \t||example.org^\t  '];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('TrimLinesTransformation - should handle empty array', () => {
    const transformation = new TrimLinesTransformation();
    const result = transformation.executeSync([]);
    assertEquals(result, []);
});
