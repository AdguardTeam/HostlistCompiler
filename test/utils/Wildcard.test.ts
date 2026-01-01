import { assertEquals, assertThrows } from '@std/assert';
import { Wildcard } from '../../src/utils/Wildcard.ts';

// Constructor tests
Deno.test('Wildcard.constructor - should throw error for empty pattern', () => {
    assertThrows(() => new Wildcard(''), Error, 'Wildcard cannot be empty');
});

Deno.test('Wildcard.constructor - should create plain string pattern', () => {
    const wildcard = new Wildcard('example');
    assertEquals(wildcard.isPlain, true);
    assertEquals(wildcard.isWildcard, false);
    assertEquals(wildcard.isRegex, false);
});

Deno.test('Wildcard.constructor - should create wildcard pattern', () => {
    const wildcard = new Wildcard('*.example.org');
    assertEquals(wildcard.isPlain, false);
    assertEquals(wildcard.isWildcard, true);
    assertEquals(wildcard.isRegex, false);
});

Deno.test('Wildcard.constructor - should create regex pattern', () => {
    const wildcard = new Wildcard('/example\\.org/');
    assertEquals(wildcard.isPlain, false);
    assertEquals(wildcard.isWildcard, false);
    assertEquals(wildcard.isRegex, true);
});

// Test with plain string
Deno.test('Wildcard.test - plain string should match substring', () => {
    const wildcard = new Wildcard('example');
    assertEquals(wildcard.test('example.org'), true);
    assertEquals(wildcard.test('www.example.org'), true);
});

Deno.test('Wildcard.test - plain string should not match non-matching string', () => {
    const wildcard = new Wildcard('example');
    assertEquals(wildcard.test('test.org'), false);
});

// Test with wildcard pattern
Deno.test('Wildcard.test - wildcard should match with asterisk', () => {
    const wildcard = new Wildcard('*.example.org');
    assertEquals(wildcard.test('www.example.org'), true);
    assertEquals(wildcard.test('sub.example.org'), true);
});

Deno.test('Wildcard.test - wildcard should match full pattern', () => {
    const wildcard = new Wildcard('||example.org^*');
    assertEquals(wildcard.test('||example.org^'), true);
    assertEquals(wildcard.test('||example.org^$important'), true);
});

Deno.test('Wildcard.test - wildcard should be case insensitive', () => {
    const wildcard = new Wildcard('*.EXAMPLE.org');
    assertEquals(wildcard.test('www.example.org'), true);
});

// Test with regex pattern
Deno.test('Wildcard.test - regex should match', () => {
    const wildcard = new Wildcard('/example\\.org$/');
    assertEquals(wildcard.test('www.example.org'), true);
    assertEquals(wildcard.test('example.org'), true);
});

Deno.test('Wildcard.test - regex should not match non-matching', () => {
    const wildcard = new Wildcard('/^www\\./');
    assertEquals(wildcard.test('example.org'), false);
});

Deno.test('Wildcard.test - regex should support patterns', () => {
    const wildcard = new Wildcard('/^example/');
    assertEquals(wildcard.test('example.org'), true);
});

// Error handling
Deno.test('Wildcard.test - should throw error for non-string input', () => {
    const wildcard = new Wildcard('example');
    assertThrows(
        () => wildcard.test(123 as unknown as string),
        Error,
        'Invalid argument passed to Wildcard.test',
    );
});

// toString
Deno.test('Wildcard.toString - should return original pattern', () => {
    const wildcard = new Wildcard('*.example.org');
    assertEquals(wildcard.toString(), '*.example.org');
});

// Pattern getter
Deno.test('Wildcard.pattern - should return original pattern', () => {
    const wildcard = new Wildcard('*.example.org');
    assertEquals(wildcard.pattern, '*.example.org');
});
