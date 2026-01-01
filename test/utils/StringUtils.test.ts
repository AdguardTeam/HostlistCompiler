import { assertEquals } from '@std/assert';
import { StringUtils } from '../../src/utils/StringUtils.ts';

Deno.test('StringUtils.substringBetween - should extract substring between tags', () => {
    assertEquals(StringUtils.substringBetween('||example.org^', '||', '^'), 'example.org');
});

Deno.test('StringUtils.substringBetween - should return null for empty string', () => {
    assertEquals(StringUtils.substringBetween('', '||', '^'), null);
});

Deno.test('StringUtils.substringBetween - should return null for null input', () => {
    assertEquals(StringUtils.substringBetween(null, '||', '^'), null);
});

Deno.test('StringUtils.substringBetween - should return null if tags not found', () => {
    assertEquals(StringUtils.substringBetween('example.org', '||', '^'), null);
});

Deno.test('StringUtils.substringBetween - should handle nested tags', () => {
    assertEquals(StringUtils.substringBetween('start||middle^end', '||', '^'), 'middle');
});

Deno.test('StringUtils.splitByDelimiterWithEscapeCharacter - should split by comma', () => {
    const result = StringUtils.splitByDelimiterWithEscapeCharacter('a,b,c', ',', '\\', false);
    assertEquals(result, ['a', 'b', 'c']);
});

Deno.test('StringUtils.splitByDelimiterWithEscapeCharacter - should handle escaped delimiters', () => {
    const result = StringUtils.splitByDelimiterWithEscapeCharacter('a\\,b,c', ',', '\\', false);
    assertEquals(result, ['a,b', 'c']);
});

Deno.test('StringUtils.splitByDelimiterWithEscapeCharacter - should return empty array for null input', () => {
    assertEquals(StringUtils.splitByDelimiterWithEscapeCharacter(null, ',', '\\', false), []);
});

Deno.test('StringUtils.splitByDelimiterWithEscapeCharacter - should preserve all tokens when requested', () => {
    const result = StringUtils.splitByDelimiterWithEscapeCharacter('a,,c', ',', '\\', true);
    assertEquals(result, ['a', '', 'c']);
});

Deno.test('StringUtils.splitByDelimiterWithEscapeCharacter - should skip empty tokens when not preserving', () => {
    const result = StringUtils.splitByDelimiterWithEscapeCharacter('a,,c', ',', '\\', false);
    assertEquals(result, ['a', 'c']);
});

Deno.test('StringUtils.escapeRegExp - should escape special regex characters', () => {
    assertEquals(
        StringUtils.escapeRegExp('.*+?^${}()|[]\\'),
        '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\',
    );
});

Deno.test('StringUtils.escapeRegExp - should not modify regular strings', () => {
    assertEquals(StringUtils.escapeRegExp('example'), 'example');
});

Deno.test('StringUtils.isEmpty - should return true for null', () => {
    assertEquals(StringUtils.isEmpty(null), true);
});

Deno.test('StringUtils.isEmpty - should return true for undefined', () => {
    assertEquals(StringUtils.isEmpty(undefined), true);
});

Deno.test('StringUtils.isEmpty - should return true for empty string', () => {
    assertEquals(StringUtils.isEmpty(''), true);
});

Deno.test('StringUtils.isEmpty - should return true for whitespace only', () => {
    assertEquals(StringUtils.isEmpty('   '), true);
});

Deno.test('StringUtils.isEmpty - should return false for non-empty string', () => {
    assertEquals(StringUtils.isEmpty('test'), false);
});

Deno.test('StringUtils.trim - should trim spaces and tabs', () => {
    assertEquals(StringUtils.trim('  \ttest\t  ', ' \t'), 'test');
});

Deno.test('StringUtils.trim - should handle custom characters', () => {
    assertEquals(StringUtils.trim('---test---', '-'), 'test');
});
