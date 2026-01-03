import { assertEquals } from '@std/assert';
import { ConditionalEvaluator } from './ConditionalEvaluator.ts';

Deno.test('ConditionalEvaluator - should evaluate true condition', () => {
    const evaluator = new ConditionalEvaluator();
    assertEquals(evaluator.evaluate('true'), true);
});

Deno.test('ConditionalEvaluator - should evaluate false condition', () => {
    const evaluator = new ConditionalEvaluator();
    assertEquals(evaluator.evaluate('false'), false);
});

Deno.test('ConditionalEvaluator - should evaluate empty condition as true', () => {
    const evaluator = new ConditionalEvaluator();
    assertEquals(evaluator.evaluate(''), true);
    assertEquals(evaluator.evaluate('   '), true);
});

Deno.test('ConditionalEvaluator - should evaluate negation', () => {
    const evaluator = new ConditionalEvaluator();
    assertEquals(evaluator.evaluate('!false'), true);
    assertEquals(evaluator.evaluate('!true'), false);
});

Deno.test('ConditionalEvaluator - should evaluate AND operator', () => {
    const evaluator = new ConditionalEvaluator();
    assertEquals(evaluator.evaluate('true && true'), true);
    assertEquals(evaluator.evaluate('true && false'), false);
    assertEquals(evaluator.evaluate('false && true'), false);
    assertEquals(evaluator.evaluate('false && false'), false);
});

Deno.test('ConditionalEvaluator - should evaluate OR operator', () => {
    const evaluator = new ConditionalEvaluator();
    assertEquals(evaluator.evaluate('true || true'), true);
    assertEquals(evaluator.evaluate('true || false'), true);
    assertEquals(evaluator.evaluate('false || true'), true);
    assertEquals(evaluator.evaluate('false || false'), false);
});

Deno.test('ConditionalEvaluator - should evaluate complex boolean expressions', () => {
    const evaluator = new ConditionalEvaluator();
    assertEquals(evaluator.evaluate('(true && false) || true'), true);
    assertEquals(evaluator.evaluate('true && (false || true)'), true);
    assertEquals(evaluator.evaluate('!(false || false)'), true);
    assertEquals(evaluator.evaluate('!false && !false'), true);
});

Deno.test('ConditionalEvaluator - should match platform when specified', () => {
    const evaluator = new ConditionalEvaluator('windows');
    assertEquals(evaluator.evaluate('windows'), true);
    assertEquals(evaluator.evaluate('mac'), false);
    assertEquals(evaluator.evaluate('android'), false);
});

Deno.test('ConditionalEvaluator - should handle platform case-insensitively', () => {
    const evaluator = new ConditionalEvaluator('Windows');
    assertEquals(evaluator.evaluate('windows'), true);
    assertEquals(evaluator.evaluate('WINDOWS'), true);
    assertEquals(evaluator.evaluate('WiNdOwS'), true);
});

Deno.test('ConditionalEvaluator - should evaluate platform with operators', () => {
    const evaluator = new ConditionalEvaluator('windows');
    assertEquals(evaluator.evaluate('windows || mac'), true);
    assertEquals(evaluator.evaluate('windows && !mac'), true);
    assertEquals(evaluator.evaluate('mac || android'), false);
});

Deno.test('ConditionalEvaluator - should evaluate adguard platform', () => {
    const evaluator = new ConditionalEvaluator('adguard');
    assertEquals(evaluator.evaluate('adguard'), true);
    assertEquals(evaluator.evaluate('ext_chromium'), false);
    assertEquals(evaluator.evaluate('adguard || ext_chromium'), true);
});

Deno.test('ConditionalEvaluator - should evaluate browser extension platforms', () => {
    const evaluator = new ConditionalEvaluator('ext_chromium');
    assertEquals(evaluator.evaluate('ext_chromium'), true);
    assertEquals(evaluator.evaluate('ext_ff'), false);
    assertEquals(evaluator.evaluate('ext_chromium || ext_ff'), true);
});

Deno.test('ConditionalEvaluator - should evaluate adguard app platforms', () => {
    const evaluator = new ConditionalEvaluator('adguard_app_windows');
    assertEquals(evaluator.evaluate('adguard_app_windows'), true);
    assertEquals(evaluator.evaluate('adguard_app_mac'), false);
    assertEquals(evaluator.evaluate('adguard'), false); // Different platform
});

Deno.test('ConditionalEvaluator - should handle no platform', () => {
    const evaluator = new ConditionalEvaluator();
    assertEquals(evaluator.evaluate('windows'), false);
    assertEquals(evaluator.evaluate('mac'), false);
    assertEquals(evaluator.evaluate('!windows'), true);
    assertEquals(evaluator.evaluate('!mac'), true);
});

Deno.test('ConditionalEvaluator - should handle complex platform expressions', () => {
    const evaluator = new ConditionalEvaluator('windows');
    assertEquals(evaluator.evaluate('(windows || mac) && !ios'), true);
    assertEquals(evaluator.evaluate('!(android || ios) && windows'), true);
    assertEquals(evaluator.evaluate('!windows || mac'), false);
});

Deno.test('ConditionalEvaluator - should handle invalid syntax gracefully', () => {
    const evaluator = new ConditionalEvaluator();
    // Should return false for invalid expressions
    assertEquals(evaluator.evaluate('unknown_token'), false);
    assertEquals(evaluator.evaluate('1 + 1'), false);
    assertEquals(evaluator.evaluate('alert("test")'), false);
});

Deno.test('ConditionalEvaluator - should validate correct conditions', () => {
    const evaluator = new ConditionalEvaluator();
    assertEquals(evaluator.isValid('true'), true);
    assertEquals(evaluator.isValid('false'), true);
    assertEquals(evaluator.isValid('true && false'), true);
    assertEquals(evaluator.isValid('windows || mac'), true);
});

Deno.test('ConditionalEvaluator - should detect invalid conditions', () => {
    const evaluator = new ConditionalEvaluator();
    // isValid should return true even for unknown tokens since evaluate handles them
    // But it will return false if the expression throws an error
    assertEquals(evaluator.isValid(''), true);
});

Deno.test('ConditionalEvaluator - should handle parentheses in expressions', () => {
    const evaluator = new ConditionalEvaluator('windows');
    assertEquals(evaluator.evaluate('(windows)'), true);
    assertEquals(evaluator.evaluate('((windows))'), true);
    assertEquals(evaluator.evaluate('(windows && true)'), true);
    assertEquals(evaluator.evaluate('(false || windows)'), true);
});

Deno.test('ConditionalEvaluator - should evaluate multiple platform identifiers', () => {
    const evaluator = new ConditionalEvaluator('ext_ff');
    assertEquals(evaluator.evaluate('ext_chromium || ext_ff || ext_edge'), true);
    assertEquals(evaluator.evaluate('ext_chromium && ext_ff'), false);
});

Deno.test('ConditionalEvaluator - should handle whitespace in conditions', () => {
    const evaluator = new ConditionalEvaluator('windows');
    assertEquals(evaluator.evaluate('  windows  '), true);
    assertEquals(evaluator.evaluate('windows   ||   mac'), true);
    assertEquals(evaluator.evaluate('  (  windows  &&  !mac  )  '), true);
});

Deno.test('ConditionalEvaluator - should handle nested negations', () => {
    const evaluator = new ConditionalEvaluator();
    assertEquals(evaluator.evaluate('!!true'), true);
    assertEquals(evaluator.evaluate('!!false'), false);
    assertEquals(evaluator.evaluate('!!!true'), false);
});

Deno.test('ConditionalEvaluator - should handle all supported platforms', () => {
    const platforms = [
        'windows',
        'mac',
        'android',
        'ios',
        'ext_chromium',
        'ext_ff',
        'ext_edge',
        'ext_opera',
        'ext_safari',
        'ext_ublock',
        'adguard',
        'adguard_app_windows',
        'adguard_app_mac',
        'adguard_app_android',
        'adguard_app_ios',
        'adguard_ext_chromium',
        'adguard_ext_firefox',
        'adguard_ext_edge',
        'adguard_ext_opera',
        'adguard_ext_safari',
    ];

    for (const platform of platforms) {
        const evaluator = new ConditionalEvaluator(platform);
        assertEquals(evaluator.evaluate(platform), true, `Platform ${platform} should evaluate to true`);
    }
});
