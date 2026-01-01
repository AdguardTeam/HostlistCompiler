import { assertEquals } from '@std/assert';
import { RemoveModifiersTransformation } from '../../src/transformations/RemoveModifiersTransformation.ts';

Deno.test('RemoveModifiersTransformation - should remove third-party modifier', () => {
    const transformation = new RemoveModifiersTransformation();
    const rules = ['||example.org^$third-party'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('RemoveModifiersTransformation - should remove 3p modifier', () => {
    const transformation = new RemoveModifiersTransformation();
    const rules = ['||example.org^$3p'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('RemoveModifiersTransformation - should remove document modifier', () => {
    const transformation = new RemoveModifiersTransformation();
    const rules = ['||example.org^$document'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('RemoveModifiersTransformation - should remove doc modifier', () => {
    const transformation = new RemoveModifiersTransformation();
    const rules = ['||example.org^$doc'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('RemoveModifiersTransformation - should remove all modifier', () => {
    const transformation = new RemoveModifiersTransformation();
    const rules = ['||example.org^$all'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('RemoveModifiersTransformation - should remove popup modifier', () => {
    const transformation = new RemoveModifiersTransformation();
    const rules = ['||example.org^$popup'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('RemoveModifiersTransformation - should remove network modifier', () => {
    const transformation = new RemoveModifiersTransformation();
    const rules = ['||example.org^$network'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('RemoveModifiersTransformation - should remove multiple modifiers', () => {
    const transformation = new RemoveModifiersTransformation();
    const rules = ['||example.org^$third-party,document'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('RemoveModifiersTransformation - should keep important modifier', () => {
    const transformation = new RemoveModifiersTransformation();
    const rules = ['||example.org^$third-party,important'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^$important']);
});

Deno.test('RemoveModifiersTransformation - should not modify comments', () => {
    const transformation = new RemoveModifiersTransformation();
    const rules = ['! Comment'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['! Comment']);
});

Deno.test('RemoveModifiersTransformation - should not modify hosts rules', () => {
    const transformation = new RemoveModifiersTransformation();
    const rules = ['0.0.0.0 example.org'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['0.0.0.0 example.org']);
});

Deno.test('RemoveModifiersTransformation - should handle empty array', () => {
    const transformation = new RemoveModifiersTransformation();
    const result = transformation.executeSync([]);
    assertEquals(result, []);
});
