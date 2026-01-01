import { assertEquals } from '@std/assert';
import { RemoveCommentsTransformation } from '../../src/transformations/RemoveCommentsTransformation.ts';

Deno.test('RemoveCommentsTransformation - should remove ! comments', () => {
    const transformation = new RemoveCommentsTransformation();
    const rules = [
        '! Comment',
        '||example.org^',
        '! Another comment',
    ];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('RemoveCommentsTransformation - should remove # comments', () => {
    const transformation = new RemoveCommentsTransformation();
    const rules = [
        '# Comment',
        '||example.org^',
    ];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('RemoveCommentsTransformation - should remove #### comments', () => {
    const transformation = new RemoveCommentsTransformation();
    const rules = [
        '#### Section',
        '||example.org^',
    ];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('RemoveCommentsTransformation - should keep hosts rules with inline comments', () => {
    const transformation = new RemoveCommentsTransformation();
    const rules = [
        '0.0.0.0 example.org # inline comment',
        '||example.org^',
    ];
    const result = transformation.executeSync(rules);
    assertEquals(result.length, 2);
});

Deno.test('RemoveCommentsTransformation - should handle empty array', () => {
    const transformation = new RemoveCommentsTransformation();
    const result = transformation.executeSync([]);
    assertEquals(result, []);
});
