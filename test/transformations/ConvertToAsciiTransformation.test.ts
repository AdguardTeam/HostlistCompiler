import { assertEquals } from '@std/assert';
import { ConvertToAsciiTransformation } from '../../src/transformations/ConvertToAsciiTransformation.ts';

Deno.test('ConvertToAsciiTransformation - should convert non-ASCII domain to punycode', () => {
    const transformation = new ConvertToAsciiTransformation();
    const rules = ['||пример.рф^'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||xn--e1afmkfd.xn--p1ai^']);
});

Deno.test('ConvertToAsciiTransformation - should not modify ASCII domains', () => {
    const transformation = new ConvertToAsciiTransformation();
    const rules = ['||example.org^'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('ConvertToAsciiTransformation - should not modify comments', () => {
    const transformation = new ConvertToAsciiTransformation();
    const rules = ['! Comment with пример'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['! Comment with пример']);
});

Deno.test('ConvertToAsciiTransformation - should not modify empty lines', () => {
    const transformation = new ConvertToAsciiTransformation();
    const rules = [''];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['']);
});

Deno.test('ConvertToAsciiTransformation - should handle hosts rules with non-ASCII', () => {
    const transformation = new ConvertToAsciiTransformation();
    const rules = ['0.0.0.0 пример.рф'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['0.0.0.0 xn--e1afmkfd.xn--p1ai']);
});

Deno.test('ConvertToAsciiTransformation - should handle wildcard patterns with non-ASCII', () => {
    const transformation = new ConvertToAsciiTransformation();
    const rules = ['||*.пример.рф^'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||*.xn--e1afmkfd.xn--p1ai^']);
});

Deno.test('ConvertToAsciiTransformation - should handle mixed ASCII and non-ASCII', () => {
    const transformation = new ConvertToAsciiTransformation();
    const rules = ['||test.пример.рф^'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||test.xn--e1afmkfd.xn--p1ai^']);
});

Deno.test('ConvertToAsciiTransformation - should handle empty array', () => {
    const transformation = new ConvertToAsciiTransformation();
    const result = transformation.executeSync([]);
    assertEquals(result, []);
});
