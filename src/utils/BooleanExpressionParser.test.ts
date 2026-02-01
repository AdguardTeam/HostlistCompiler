import { assertEquals } from '@std/assert';
import { evaluateBooleanExpression, getKnownPlatforms, isKnownPlatform } from './BooleanExpressionParser.ts';

Deno.test('BooleanExpressionParser - evaluates true literal', () => {
    assertEquals(evaluateBooleanExpression('true'), true);
});

Deno.test('BooleanExpressionParser - evaluates false literal', () => {
    assertEquals(evaluateBooleanExpression('false'), false);
});

Deno.test('BooleanExpressionParser - evaluates NOT operator', () => {
    assertEquals(evaluateBooleanExpression('!true'), false);
    assertEquals(evaluateBooleanExpression('!false'), true);
    assertEquals(evaluateBooleanExpression('!!true'), true);
});

Deno.test('BooleanExpressionParser - evaluates AND operator', () => {
    assertEquals(evaluateBooleanExpression('true && true'), true);
    assertEquals(evaluateBooleanExpression('true && false'), false);
    assertEquals(evaluateBooleanExpression('false && true'), false);
    assertEquals(evaluateBooleanExpression('false && false'), false);
});

Deno.test('BooleanExpressionParser - evaluates OR operator', () => {
    assertEquals(evaluateBooleanExpression('true || true'), true);
    assertEquals(evaluateBooleanExpression('true || false'), true);
    assertEquals(evaluateBooleanExpression('false || true'), true);
    assertEquals(evaluateBooleanExpression('false || false'), false);
});

Deno.test('BooleanExpressionParser - evaluates parentheses', () => {
    assertEquals(evaluateBooleanExpression('(true)'), true);
    assertEquals(evaluateBooleanExpression('(false)'), false);
    assertEquals(evaluateBooleanExpression('(true && false) || true'), true);
    assertEquals(evaluateBooleanExpression('true && (false || true)'), true);
    assertEquals(evaluateBooleanExpression('!(true && false)'), true);
});

Deno.test('BooleanExpressionParser - evaluates complex expressions', () => {
    assertEquals(evaluateBooleanExpression('!false && true'), true);
    assertEquals(evaluateBooleanExpression('true || false && true'), true);
    assertEquals(evaluateBooleanExpression('(true || false) && (true || false)'), true);
});

Deno.test('BooleanExpressionParser - evaluates platform identifiers', () => {
    assertEquals(evaluateBooleanExpression('windows', 'windows'), true);
    assertEquals(evaluateBooleanExpression('windows', 'mac'), false);
    assertEquals(evaluateBooleanExpression('mac', 'mac'), true);
    assertEquals(evaluateBooleanExpression('!windows', 'mac'), true);
});

Deno.test('BooleanExpressionParser - evaluates platform with operators', () => {
    assertEquals(evaluateBooleanExpression('windows || mac', 'windows'), true);
    assertEquals(evaluateBooleanExpression('windows || mac', 'mac'), true);
    assertEquals(evaluateBooleanExpression('windows || mac', 'android'), false);
    assertEquals(evaluateBooleanExpression('windows && !ext_safari', 'windows'), true);
});

Deno.test('BooleanExpressionParser - handles empty expression', () => {
    assertEquals(evaluateBooleanExpression(''), true);
    assertEquals(evaluateBooleanExpression('   '), true);
});

Deno.test('BooleanExpressionParser - handles unknown identifiers', () => {
    assertEquals(evaluateBooleanExpression('unknown_platform'), false);
    assertEquals(evaluateBooleanExpression('unknown_platform', 'windows'), false);
});

Deno.test('isKnownPlatform - recognizes known platforms', () => {
    assertEquals(isKnownPlatform('windows'), true);
    assertEquals(isKnownPlatform('mac'), true);
    assertEquals(isKnownPlatform('android'), true);
    assertEquals(isKnownPlatform('ext_chromium'), true);
    assertEquals(isKnownPlatform('WINDOWS'), true); // Case insensitive
});

Deno.test('isKnownPlatform - rejects unknown platforms', () => {
    assertEquals(isKnownPlatform('unknown'), false);
    assertEquals(isKnownPlatform('linux'), false);
});

Deno.test('getKnownPlatforms - returns list of platforms', () => {
    const platforms = getKnownPlatforms();
    assertEquals(platforms.includes('windows'), true);
    assertEquals(platforms.includes('mac'), true);
    assertEquals(platforms.includes('android'), true);
    assertEquals(platforms.length > 10, true);
});

Deno.test('BooleanExpressionParser - handles deeply nested NOT operators without stack overflow', () => {
    // Create a deeply nested NOT expression that would previously cause stack overflow
    // With 200 NOTs, this should hit the recursion limit (MAX_NOT_DEPTH = 100)
    const deeplyNested = '!'.repeat(200) + 'true';
    
    // Should not throw and should return false (due to depth limit)
    const result = evaluateBooleanExpression(deeplyNested);
    assertEquals(result, false);
});

Deno.test('BooleanExpressionParser - handles moderate NOT nesting correctly', () => {
    // Test that we can still handle reasonable nesting (under the limit)
    const moderateNesting = '!'.repeat(50) + 'true';
    
    // 50 NOTs on true should give us true (even number of NOTs)
    const result = evaluateBooleanExpression(moderateNesting);
    assertEquals(result, true);
});
