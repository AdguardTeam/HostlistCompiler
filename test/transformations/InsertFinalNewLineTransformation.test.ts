import { assertEquals } from '@std/assert';
import { InsertFinalNewLineTransformation } from '../../src/transformations/InsertFinalNewLineTransformation.ts';

Deno.test('InsertFinalNewLineTransformation - should add newline to non-empty list', () => {
    const transformation = new InsertFinalNewLineTransformation();
    const rules = ['||example.org^'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^', '']);
});

Deno.test('InsertFinalNewLineTransformation - should add newline to empty list', () => {
    const transformation = new InsertFinalNewLineTransformation();
    const result = transformation.executeSync([]);
    assertEquals(result, ['']);
});

Deno.test('InsertFinalNewLineTransformation - should not add newline if already present', () => {
    const transformation = new InsertFinalNewLineTransformation();
    const rules = ['||example.org^', ''];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^', '']);
});

Deno.test('InsertFinalNewLineTransformation - should not add newline if last line is whitespace', () => {
    const transformation = new InsertFinalNewLineTransformation();
    const rules = ['||example.org^', '   '];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^', '   ']);
});
