import { assertEquals, assertExists } from '@std/assert';
import { ValidationSeverity } from '../types/index.ts';
import { ValidateAllowIpTransformation, ValidateTransformation } from '../../src/transformations/ValidateTransformation.ts';

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

// Validation error collection tests
Deno.test('ValidateTransformation - should collect error for unsupported modifier', () => {
    const transformation = new ValidateTransformation();
    const rules = ['||example.org^$popup'];
    const result = transformation.executeSync(rules);
    assertEquals(result, []);

    const report = transformation.getValidationReport();
    assertExists(report);
    assertEquals(report.totalRules, 1);
    assertEquals(report.validRules, 0);
    assertEquals(report.invalidRules, 1);
    assertEquals(report.errorCount, 1);
    assertEquals(report.errors.length, 1);
    assertEquals(report.errors[0].type, 'unsupported_modifier');
    assertEquals(report.errors[0].severity, ValidationSeverity.Error);
    assertEquals(report.errors[0].ruleText, '||example.org^$popup');
    assertEquals(report.errors[0].lineNumber, 1);
});

Deno.test('ValidateTransformation - should collect error for pattern too short', () => {
    const transformation = new ValidateTransformation();
    const rules = ['||ab^'];
    const result = transformation.executeSync(rules);
    assertEquals(result, []);

    const report = transformation.getValidationReport();
    assertExists(report);
    assertEquals(report.errorCount, 1);
    assertEquals(report.errors[0].type, 'pattern_too_short');
    assertEquals(report.errors[0].severity, ValidationSeverity.Error);
});

Deno.test('ValidateTransformation - should collect error for public suffix matching', () => {
    const transformation = new ValidateTransformation();
    const rules = ['||com^'];
    const result = transformation.executeSync(rules);
    assertEquals(result, []);

    const report = transformation.getValidationReport();
    assertExists(report);
    assertEquals(report.errorCount, 1);
    assertEquals(report.errors[0].type, 'public_suffix_match');
});

Deno.test('ValidateTransformation - should collect error for IP not allowed', () => {
    const transformation = new ValidateTransformation(false);
    const rules = ['||192.168.1.1^'];
    const result = transformation.executeSync(rules);
    assertEquals(result, []);

    const report = transformation.getValidationReport();
    assertExists(report);
    assertEquals(report.errorCount, 1);
    assertEquals(report.errors[0].type, 'ip_not_allowed');
});

Deno.test('ValidateTransformation - should collect multiple errors', () => {
    const transformation = new ValidateTransformation();
    const rules = [
        '||example.org^$popup',
        '||ab^',
        '||com^',
        '||valid.org^',
    ];
    const result = transformation.executeSync(rules);
    assertEquals(result, ['||valid.org^']);

    const report = transformation.getValidationReport();
    assertExists(report);
    assertEquals(report.totalRules, 4);
    assertEquals(report.validRules, 1);
    assertEquals(report.invalidRules, 3);
    assertEquals(report.errorCount, 3);
    assertEquals(report.errors.length, 3);
});

Deno.test('ValidateTransformation - should have correct line numbers', () => {
    const transformation = new ValidateTransformation();
    const rules = [
        '||valid1.org^',
        '||com^',
        '||valid2.org^',
        '||ab^',
    ];
    const result = transformation.executeSync(rules);
    assertEquals(result.length, 2);

    const report = transformation.getValidationReport();
    assertExists(report);
    assertEquals(report.errors.length, 2);
    // Line numbers should be 1-based
    assertEquals(report.errors[0].lineNumber, 4); // 'ab^' is at index 3, line 4
    assertEquals(report.errors[1].lineNumber, 2); // 'com^' is at index 1, line 2
});

Deno.test('ValidateTransformation - should track source name', () => {
    const transformation = new ValidateTransformation();
    transformation.setSourceName('My Filter List');
    const rules = ['||ab^'];
    const result = transformation.executeSync(rules);
    assertEquals(result, []);

    const report = transformation.getValidationReport();
    assertExists(report);
    assertEquals(report.errors[0].sourceName, 'My Filter List');
});

Deno.test('ValidateTransformation - should reset errors on each run', () => {
    const transformation = new ValidateTransformation();

    // First run
    const rules1 = ['||ab^'];
    transformation.executeSync(rules1);
    const report1 = transformation.getValidationReport();
    assertExists(report1);
    assertEquals(report1.errors.length, 1);

    // Second run - should have different errors
    const rules2 = ['||com^', '||org^'];
    transformation.executeSync(rules2);
    const report2 = transformation.getValidationReport();
    assertExists(report2);
    assertEquals(report2.errors.length, 2);
    assertEquals(report2.totalRules, 2);
});

Deno.test('ValidateTransformation - should return null report before first run', () => {
    const transformation = new ValidateTransformation();
    const report = transformation.getValidationReport();
    assertEquals(report, null);
});
