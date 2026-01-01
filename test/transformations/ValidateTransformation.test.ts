import { assertEquals } from '@std/assert';
import { ValidateTransformation, ValidateAllowIpTransformation } from '../../src/transformations/ValidateTransformation.ts';

// ValidateTransformation - valid rules
Deno.test('ValidateTransformation - should keep valid domain rules', () => {
    const transformation = new ValidateTransformation();
    const rules = ['||example.org^'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^']);
});

Deno.test('ValidateTransformation - should keep comments', () => {
    const transformation = new ValidateTransformation();
    const rules = ['! Comment'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['! Comment']);
});

Deno.test('ValidateTransformation - should keep empty lines', () => {
    const transformation = new ValidateTransformation();
    const rules = [''];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['']);
});

Deno.test('ValidateTransformation - should keep valid hosts rules', () => {
    const transformation = new ValidateTransformation();
    const rules = ['0.0.0.0 example.org'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['0.0.0.0 example.org']);
});

Deno.test('ValidateTransformation - should keep rules with supported modifiers', () => {
    const transformation = new ValidateTransformation();
    const rules = ['||example.org^$important'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||example.org^$important']);
});

Deno.test('ValidateTransformation - should keep regex rules', () => {
    const transformation = new ValidateTransformation();
    const rules = ['/example\\.org/'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['/example\\.org/']);
});

// ValidateTransformation - invalid rules
Deno.test('ValidateTransformation - should remove rules with unsupported modifiers', () => {
    const transformation = new ValidateTransformation();
    const rules = ['||example.org^$unsupported'];
    const result = transformation.executeSync(rules);
    assertEquals(result, []);
});

Deno.test('ValidateTransformation - should remove too short rules', () => {
    const transformation = new ValidateTransformation();
    const rules = ['||ex'];
    const result = transformation.executeSync(rules);
    assertEquals(result, []);
});

Deno.test('ValidateTransformation - should remove rules blocking public suffix', () => {
    const transformation = new ValidateTransformation();
    const rules = ['||org^'];
    const result = transformation.executeSync(rules);
    assertEquals(result, []);
});

Deno.test('ValidateTransformation - should remove IP-based rules by default', () => {
    const transformation = new ValidateTransformation();
    const rules = ['||127.0.0.1^'];
    const result = transformation.executeSync(rules);
    assertEquals(result, []);
});

Deno.test('ValidateTransformation - should remove preceding comments for invalid rules', () => {
    const transformation = new ValidateTransformation();
    const rules = [
        '! Comment for invalid',
        '||org^',
    ];
    const result = transformation.executeSync(rules);
    assertEquals(result, []);
});

// ValidateTransformation - with denyallow modifier
Deno.test('ValidateTransformation - should allow TLD rules with denyallow', () => {
    const transformation = new ValidateTransformation();
    const rules = ['||org^$denyallow=example.org'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||org^$denyallow=example.org']);
});

// ValidateAllowIpTransformation tests
Deno.test('ValidateAllowIpTransformation - should allow IP-based rules', () => {
    const transformation = new ValidateAllowIpTransformation();
    const rules = ['||127.0.0.1^'];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||127.0.0.1^']);
});

Deno.test('ValidateAllowIpTransformation - should still validate other aspects', () => {
    const transformation = new ValidateAllowIpTransformation();
    const rules = ['||x^'];
    const result = transformation.executeSync(rules);
    assertEquals(result, []);
});
